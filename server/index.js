import express from 'express';
import cors from 'cors';
import { open } from 'sqlite';
import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
// Handle malformed JSON bodies gracefully
app.use((err, req, res, next) => {
  if (err && err.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'BAD_JSON' });
  }
  next(err);
});

// Static serve client for convenience
app.use('/', express.static(path.join(__dirname, '..')));

let db;
async function initDb(){
  const dbPath = process.env.DB_PATH || path.join(__dirname, 'data.sqlite');
  db = await open({ filename: dbPath, driver: sqlite3.Database });
  await db.exec(`
    CREATE TABLE IF NOT EXISTS requests (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      phone TEXT NOT NULL,
      sum INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      meta JSON
    );
    CREATE TABLE IF NOT EXISTS sms_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      attempts INTEGER DEFAULT 0,
      expires_at TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    );
    CREATE INDEX IF NOT EXISTS idx_sms_phone ON sms_codes(phone);
  `);
}

app.get('/api/health', (req,res)=>{ res.json({ ok:true }); });

app.post('/api/request', async (req,res)=>{
  try{
    const { name, phone, sum, source, extra } = req.body || {};
    if(!phone || String(phone).replace(/\D/g,'').length < 10){
      return res.status(400).json({ ok:false, error:'INVALID_PHONE' });
    }
    const sumVal = sum? Number(sum) : null;
    const meta = JSON.stringify({ source: source||'web', extra: extra||null });
    const result = await db.run(
      `INSERT INTO requests (name, phone, sum, meta) VALUES (?, ?, ?, ?)`,
      [name||null, phone, sumVal, meta]
    );
    res.json({ ok:true, id: result.lastID });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:'SERVER_ERROR' });
  }
});

app.get('/api/requests', async (req,res)=>{
  try{
    const rows = await db.all(`SELECT id, name, phone, sum, created_at, meta FROM requests ORDER BY id DESC LIMIT 100;`);
    res.json({ ok:true, items: rows });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:'SERVER_ERROR' });
  }
});

// Simple math captcha in-memory store
const captchaStore = new Map(); // id -> { answer, expiresAt }
function newCaptcha(){
  const a = Math.floor(Math.random()*9)+1;
  const b = Math.floor(Math.random()*9)+1;
  const answer = String(a+b);
  const id = crypto.randomBytes(8).toString('hex');
  const expiresAt = Date.now() + 5*60*1000; // 5 min
  captchaStore.set(id, { answer, expiresAt });
  return { id, question: `Сколько будет ${a} + ${b}?` };
}
app.post('/api/captcha/new', (req,res)=>{
  const c = newCaptcha();
  const echo = process.env.SMS_ECHO === 'true' ? { echoAnswer: captchaStore.get(c.id)?.answer } : {};
  res.json({ ok:true, id: c.id, question: c.question, ...echo });
});

// Send SMS code: validate captcha, generate code, store in DB, "send" by logging
app.post('/api/sms/send', async (req,res)=>{
  try{
    const { phone, captchaId, captcha } = req.body || {};
    const digits = String(phone||'').replace(/\D/g,'');
    if(!digits || digits.length < 10) return res.status(400).json({ ok:false, error:'INVALID_PHONE' });
    const entry = captchaStore.get(String(captchaId||''));
    if(!entry) return res.status(400).json({ ok:false, error:'CAPTCHA_NOT_FOUND' });
    if(Date.now() > entry.expiresAt){ captchaStore.delete(String(captchaId||'')); return res.status(400).json({ ok:false, error:'CAPTCHA_EXPIRED' }); }
    if(String(captcha||'').trim() !== entry.answer){ return res.status(400).json({ ok:false, error:'CAPTCHA_INVALID' }); }
    captchaStore.delete(String(captchaId||''));

    const code = ('' + Math.floor(1000 + Math.random()*9000)); // 4-digit
    const expiresAt = new Date(Date.now() + 5*60*1000).toISOString();
    // Remove previous codes for this phone
    await db.run(`DELETE FROM sms_codes WHERE phone = ?`, [digits]);
    await db.run(`INSERT INTO sms_codes (phone, code, attempts, expires_at) VALUES (?, ?, 0, ?)`, [digits, code, expiresAt]);

    // Simulate SMS sending
    console.log(`[SMS] to ${digits}: code ${code} (valid 5 min)`);

    const echo = process.env.SMS_ECHO === 'true' ? { echoCode: code } : {};
    res.json({ ok:true, ...echo });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:'SERVER_ERROR' });
  }
});

// Verify SMS code and create request
app.post('/api/sms/verify', async (req,res)=>{
  try{
    const { phone, code, name, sum, source } = req.body || {};
    const digits = String(phone||'').replace(/\D/g,'');
    if(!digits || digits.length < 10) return res.status(400).json({ ok:false, error:'INVALID_PHONE' });
    const row = await db.get(`SELECT * FROM sms_codes WHERE phone = ?`, [digits]);
    if(!row) return res.status(400).json({ ok:false, error:'CODE_NOT_FOUND' });
    const now = Date.now();
    if(now > Date.parse(row.expires_at)){
      await db.run(`DELETE FROM sms_codes WHERE phone = ?`, [digits]);
      return res.status(400).json({ ok:false, error:'CODE_EXPIRED' });
    }
    if(row.attempts >= 5){
      return res.status(429).json({ ok:false, error:'TOO_MANY_ATTEMPTS' });
    }
    if(String(code||'') !== row.code){
      await db.run(`UPDATE sms_codes SET attempts = attempts + 1 WHERE id = ?`, [row.id]);
      return res.status(400).json({ ok:false, error:'CODE_INVALID' });
    }
    // Success: consume code and create request
    await db.run(`DELETE FROM sms_codes WHERE phone = ?`, [digits]);
    const sumVal = sum? Number(sum) : null;
    const meta = JSON.stringify({ source: source||'sms-verified', via: 'otp' });
    const result = await db.run(
      `INSERT INTO requests (name, phone, sum, meta) VALUES (?, ?, ?, ?)`,
      [name||null, digits, sumVal, meta]
    );
    res.json({ ok:true, id: result.lastID });
  }catch(err){
    console.error(err);
    res.status(500).json({ ok:false, error:'SERVER_ERROR' });
  }
});

initDb().then(()=>{
  app.listen(PORT, ()=> console.log(`API listening on http://localhost:${PORT}`));
}).catch(err=>{
  console.error('DB init failed', err);
  process.exit(1);
});
