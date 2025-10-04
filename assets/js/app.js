/*
  Interactive logic for demo site replicating mos-capital.ru patterns
*/
(function(){
  const $ = (s,root=document)=>root.querySelector(s);
  const $$ = (s,root=document)=>Array.from(root.querySelectorAll(s));

  // Burger + mobile drawer
  const burger = $('.burger');
  const drawer = $('#mobileMenu');
  if(burger && drawer){
    burger.addEventListener('click', ()=>{
      const open = burger.classList.toggle('active');
      burger.setAttribute('aria-expanded', String(open));
      if(open){
        drawer.hidden = false;
        // trigger transition
        requestAnimationFrame(()=> drawer.classList.add('open'));
      }else{
        drawer.classList.remove('open');
        drawer.addEventListener('transitionend', function onEnd(){
          drawer.hidden = true; drawer.removeEventListener('transitionend', onEnd);
        });
      }
    });
    // close on link click
    $$('#mobileMenu a').forEach(a=>a.addEventListener('click', ()=>{
      if(burger.classList.contains('active')) burger.click();
    }));
  }

  // Smooth scroll for in-page anchors
  $$('.nav a[href^="#"], .mobile-drawer a[href^="#"], .foot-links a[href^="#" ]').forEach(a=>{
    a.addEventListener('click', (e)=>{
      const id = a.getAttribute('href');
      const target = id && $(id);
      if(target){ e.preventDefault(); target.scrollIntoView({behavior:'smooth', block:'start'}); }
    });
  });

  // Calculator
  const amount = $('#amount');
  const term = $('#term');
  const amountOut = $('#amountOut');
  const termOut = $('#termOut');
  const paymentOut = $('#payment');
  function formatMoney(x){
    return new Intl.NumberFormat('ru-RU', {maximumFractionDigits:0}).format(x) + ' ₽';
  }
  function recalc(){
    const S = parseInt(amount.value,10)||0; // сумма
    const m = parseInt(term.value,10)||1;   // срок в месяцах
    const i = 0.02; // 2%/мес ориентир
    // Аннуитетная формула: A = S * i * (1+i)^m / ((1+i)^m - 1)
    const pow = Math.pow(1+i, m);
    const A = S * i * pow / (pow - 1);
    paymentOut.textContent = formatMoney(Math.round(A));
    amountOut.value = formatMoney(S);
    termOut.value = m + ' мес.';
  }
  if(amount && term){
    amount.addEventListener('input', recalc);
    term.addEventListener('input', recalc);
    recalc();
  }

  // Tabs
  // (tabs removed)

  // Accordion
  const acc = $('[data-accordion]');
  if(acc){
    acc.addEventListener('click', (e)=>{
      const head = e.target.closest('.acc-head');
      if(!head) return;
      const item = head.parentElement;
      const body = $('.acc-body', item);
      const expanded = head.getAttribute('aria-expanded') === 'true';
      // close others (classic FAQ)
      $$('.acc-item', acc).forEach(it=>{
        if(it!==item){
          $('.acc-head',it).setAttribute('aria-expanded','false');
          const b=$('.acc-body',it); b.hidden = true; b.style.maxHeight = null;
        }
      });
      // toggle current
      head.setAttribute('aria-expanded', String(!expanded));
      if(expanded){
        body.style.maxHeight = body.scrollHeight + 'px'; // set to current to enable transition
        requestAnimationFrame(()=>{
          body.style.maxHeight = '0px';
          body.addEventListener('transitionend', function onEnd(){ body.hidden=true; body.style.maxHeight=null; body.removeEventListener('transitionend', onEnd);});
        });
      }else{
        body.hidden = false;
        body.style.maxHeight = '0px';
        requestAnimationFrame(()=> body.style.maxHeight = body.scrollHeight + 'px');
        body.addEventListener('transitionend', function onEnd(){ body.style.maxHeight='none'; body.removeEventListener('transitionend', onEnd);});
      }
    });
  }

  // Phone mask util
  function maskPhoneInput(input){
    function format(v){
      const d = v.replace(/\D/g,'');
      // normalize to +7 format
      let out = '+7 (';
      const body = d.replace(/^7|^8/, '');
      if(body.length===0) return '+7 (';
      out += body.substring(0,3);
      if(body.length>=3) out += ') ' + body.substring(3,6);
      if(body.length>=6) out += '-' + body.substring(6,8);
      if(body.length>=8) out += '-' + body.substring(8,10);
      return out;
    }
    input.addEventListener('input', ()=>{
      const p = input.selectionStart;
      input.value = format(input.value);
      input.setSelectionRange(input.value.length, input.value.length);
    });
    input.addEventListener('focus', ()=>{ if(!input.value) input.value = '+7 ('; });
    input.addEventListener('blur', ()=>{ if(input.value.replace(/\D/g,'').length < 11) input.value=''; });
  }
  $$('input[type="tel"]').forEach(maskPhoneInput);

  // Forms validation + submit helpers
  function validateForm(form){
    const required = $$('[required]', form);
    let ok = true;
    required.forEach(f=>{
      const isTel = f.type==='tel';
      const isCheckbox = f.type==='checkbox';
      const emptyTel = isTel && f.value.replace(/\D/g,'').length < 11;
      const emptyCheckbox = isCheckbox && !f.checked;
      if(!f.value || emptyTel || emptyCheckbox){
        ok = false; f.classList.add('invalid');
      } else f.classList.remove('invalid');
    });
    return ok;
  }
  function apiBase(){ return window.__API_BASE__ || ''; }
  async function submitToApi(payload){
    const res = await fetch(apiBase() + '/api/request', {
      method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(payload)
    });
    if(!res.ok) throw new Error('REQUEST_FAILED');
    return res.json();
  }
  async function apiPost(path, body){
    const res = await fetch(apiBase() + path, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(body||{}) });
    const data = await res.json().catch(()=>({}));
    if(!res.ok || data.ok===false) throw Object.assign(new Error('API_ERROR'), { data });
    return data;
  }

  function wireForm(id, map){
    const form = $(id);
    if(!form) return;
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      if(!validateForm(form)) return;
      const fd = new FormData(form);
      const payload = map ? map(fd) : Object.fromEntries(fd.entries());
      submitToApi(payload).then(r=>{
        alert('Спасибо! Ваша заявка принята. №'+r.id);
        const modal = form.closest('.modal');
        if(modal) modal.hidden = true;
        form.reset();
      }).catch(()=>{
        alert('Не удалось отправить заявку. Попробуйте позже.');
      });
    });
  }
  wireForm('#leadFormTop', (fd)=>{
    const phone = String(fd.get('phone')||'');
    try{ sessionStorage.setItem('apply_phone', phone); }catch{}
    return { phone, source: 'hero-lead' };
  });
  (function(){
    const form = $('#callbackForm');
    if(!form) return;
    form.addEventListener('submit', (e)=>{
      e.preventDefault();
      if(!validateForm(form)) return;
      const fd = new FormData(form);
      submitToApi({ phone: String(fd.get('phone')||''), source:'callback' }).then(r=>{
        alert('Спасибо! Мы скоро перезвоним. №'+r.id);
        closeModal('#callbackModal');
        form.reset();
      }).catch(()=> alert('Не удалось отправить. Попробуйте позже.'));
    });
  })();

  // Modals
  function openModal(sel){
    const m = $(sel); if(!m) return;
    m.hidden = false;
  }
  function closeModal(sel){
    const m = $(sel); if(!m) return;
    m.hidden = true;
  }
  $$('[data-modal-target]').forEach(btn=>{
    btn.addEventListener('click', ()=> openModal(btn.dataset.modalTarget));
  });
  $$('[data-modal-close]').forEach(btn=>{
    btn.addEventListener('click', ()=>{ const m = btn.closest('.modal'); if(m) m.hidden = true; });
  });
  document.addEventListener('keydown', (e)=>{
    if(e.key==='Escape') $$('.modal').forEach(m=> m.hidden = true);
  });

  // Dropdown a11y: close submenu on outside click
  document.addEventListener('click', (e)=>{
    const sub = e.target.closest('.has-sub');
    if(!sub){
      $$('.submenu').forEach(s=> s.style.display='');
    }
  });
  $$('.has-sub > a').forEach(link=>{
    link.addEventListener('click', (e)=>{
      // Allow anchor navigation while also toggling submenu
      const li = link.parentElement;
      const sm = $('.submenu', li);
      if(sm){ e.preventDefault(); sm.style.display = (sm.style.display==='block'?'':'block'); }
    });
  });

  // Apply flow: Step 1 (phone + captcha) -> send SMS, Step 2 -> verify
  const applyBtn = $('#applyBtn');
  if(applyBtn){
    applyBtn.addEventListener('click', async ()=>{
      // If we already have phone from earlier, prefill and lock the field
      const stored = sessionStorage.getItem('apply_phone')||'';
      const phEl = $('#pc_phone');
      const hasPhone = stored && stored.replace(/\D/g,'').length>=11;
      if(phEl){
        if(hasPhone){ phEl.value = stored; phEl.disabled = true; }
        else { phEl.disabled = false; phEl.value = ''; }
      }
      if(hasPhone){
        // Try to auto-create captcha and send SMS (in dev SMS_ECHO exposes answer). If fails, fallback to captcha modal.
        try{
          const c = await apiPost('/api/captcha/new', {});
          if(!c.id){ throw new Error('NO_CAPTCHA'); }
          const sendRes = await apiPost('/api/sms/send', { phone: stored, captchaId: c.id, captcha: c.echoAnswer||'' });
          // If succeeded, open SMS modal directly
            openModal('#smsModal');
            if(sendRes.echoCode){
              console.log('SMS test code:', sendRes.echoCode);
              const codeInput = $('#sms_code'); if(codeInput) codeInput.placeholder = sendRes.echoCode;
            }
          return;
        }catch(e){
          // fallback to manual captcha
          openModal('#phoneCaptchaModal');
          await refreshCaptcha();
          return;
        }
      } else {
        openModal('#phoneCaptchaModal');
        await refreshCaptcha();
      }
    });
  }

  async function refreshCaptcha(){
    const qEl = $('#captchaQuestion');
    const idEl = $('#pc_captcha_id');
    if(!qEl || !idEl) return;
    try{
      const data = await apiPost('/api/captcha/new', {});
      qEl.textContent = data.question;
      idEl.value = data.id;
    }catch{
      qEl.textContent = 'Не удалось загрузить капчу. Попробуйте ещё раз';
    }
  }

  const phoneCaptchaForm = $('#phoneCaptchaForm');
  if(phoneCaptchaForm){
    phoneCaptchaForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!validateForm(phoneCaptchaForm)) return;
      const fd = new FormData(phoneCaptchaForm);
      const payload = {
        phone: String(fd.get('phone')|| sessionStorage.getItem('apply_phone') || ''),
        captchaId: String(fd.get('captchaId')||''),
        captcha: String(fd.get('captcha')||'')
      };
      try{
        const res = await apiPost('/api/sms/send', payload);
        // proceed to SMS modal
        closeModal('#phoneCaptchaModal');
        openModal('#smsModal');
        // store phone temporarily
        sessionStorage.setItem('apply_phone', payload.phone);
        // For testing, optionally alert echo code
          if(res.echoCode){
            console.log('SMS test code:', res.echoCode);
            const codeInput = $('#sms_code'); if(codeInput) codeInput.placeholder = res.echoCode;
          }
      }catch(err){
        const code = err?.data?.error;
        if(code==='CAPTCHA_INVALID') alert('Неверный ответ на капчу');
        else if(code==='CAPTCHA_EXPIRED') alert('Капча истекла, попробуйте снова');
        else alert('Не удалось отправить SMS. Попробуйте позже.');
        refreshCaptcha();
      }
    });
  }

  const smsForm = $('#smsForm');
  if(smsForm){
    smsForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!validateForm(smsForm)) return;
      const phone = sessionStorage.getItem('apply_phone')||'';
      const fd = new FormData(smsForm);
      const code = String(fd.get('code')||'');
      try{
        const res = await apiPost('/api/sms/verify', { phone, code, source:'apply-sms' });
        alert('Заявка подтверждена! №'+res.id);
        closeModal('#smsModal');
        smsForm.reset();
      }catch(err){
        const code = err?.data?.error;
        if(code==='CODE_INVALID') alert('Неверный код');
        else if(code==='CODE_EXPIRED') alert('Код истёк, запросите новый');
        else if(code==='TOO_MANY_ATTEMPTS') alert('Слишком много попыток. Запросите новый код позже.');
        else alert('Не удалось подтвердить код. Попробуйте позже.');
      }
    });
  }

  // New: calculator inline apply form with consent
  const calcApplyForm = $('#calcApplyForm');
  if(calcApplyForm){
    calcApplyForm.addEventListener('submit', async (e)=>{
      e.preventDefault();
      if(!validateForm(calcApplyForm)) return;
      const fd = new FormData(calcApplyForm);
      const phone = String(fd.get('phone')||'');
      const consent = $('#consentCalc');
      if(consent && !consent.checked){ alert('Подтвердите согласие на обработку персональных данных'); return; }
      try{ sessionStorage.setItem('apply_phone', phone); }catch{}
      // Open SMS flow (same as apply button auto path)
      try{
        const c = await apiPost('/api/captcha/new', {});
        const sendRes = await apiPost('/api/sms/send', { phone, captchaId: c.id, captcha: c.echoAnswer||'' });
        openModal('#smsModal');
        if(sendRes.echoCode){ const codeInput=$('#sms_code'); if(codeInput) codeInput.placeholder = sendRes.echoCode; }
      }catch{
        openModal('#phoneCaptchaModal');
        await refreshCaptcha();
      }
    });
  }

  // Pledge cards buttons scroll
  $$('[data-anchor]')
    .forEach(btn=> btn.addEventListener('click', ()=>{
      const t = '#'+btn.getAttribute('data-anchor');
      const el = $(t); if(el) el.scrollIntoView({behavior:'smooth', block:'start'});
    }));

  // Cookie bar
  const cookieBar = $('#cookieBar');
  if(cookieBar){
    const key = 'cookieAcceptedV1';
    if(!localStorage.getItem(key)) cookieBar.hidden = false;
    $('#cookieAccept')?.addEventListener('click', ()=>{ localStorage.setItem(key,'1'); cookieBar.hidden = true; });
    $('#cookieClose')?.addEventListener('click', ()=>{ cookieBar.hidden = true; });
  }

  // Floating buttons
  const btnUp = $('#btnUp');
  window.addEventListener('scroll', ()=>{
    const show = window.scrollY > 400;
    if(btnUp) btnUp.style.display = show ? 'block' : 'none';
  });
  btnUp?.addEventListener('click', ()=> window.scrollTo({top:0, behavior:'smooth'}));
  $$('.btn-floating').forEach(b=> b.addEventListener('click', ()=>{
    const url = b.getAttribute('data-open'); if(url) window.open(url,'_blank');
  }));

  // Simple AOS (Animate on Scroll)
  const aosEls = $$('[data-aos]');
  if('IntersectionObserver' in window && aosEls.length){
    const io = new IntersectionObserver((entries)=>{
      entries.forEach(en=>{
        if(en.isIntersecting){ en.target.classList.add('aos-in'); io.unobserve(en.target); }
      });
    }, {threshold:.2});
    aosEls.forEach(el=> io.observe(el));
  }
})();
