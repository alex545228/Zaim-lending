# Zaim-service (demo)

Статический проект, повторяющий визуальную структуру и интерактивную логику целевого сайта.

Содержимое:
- `index.html` — главная страница
- `assets/css/style.css` — дизайн-токены, компоненты, адаптив, анимации
- `assets/js/app.js` — логика (бургер-меню, плавный скролл, калькулятор, табы, аккордеоны, формы, модалки, cookie-бар, кнопка вверх, мини-AOS)
 - `server/` — Node.js + SQLite API (хранение заявок, SMS-верификация, капча)
 - `Dockerfile` — запуск фронта+API в одном контейнере

Как открыть:
- Вариант A (без БД): откройте `index.html` в браузере.
- Вариант B (c БД и API): запустите Node-сервер или Docker (см. ниже), затем открывайте `http://localhost:8080`.

Что реализовано:
- Липкая шапка, мобильное меню с анимацией (off-canvas)
- Плавный скролл к якорям
- Калькулятор слайдерами (сумма/срок) с аннуитетным платежом ~2%/мес
- Табы и аккордеон с плавной анимацией
 - Формы с базовой валидацией и отправкой в API
 - SMS-подтверждение заявки: шаг 1 — телефон + капча, шаг 2 — ввод кода
 - Маска ввода для телефона во всех полях `type=tel`
 - Модальные окна (перезвонить, заявка через SMS)
- Cookie-бар с запоминанием в `localStorage`
- Плавающие кнопки WhatsApp/Telegram и кнопка «Наверх»
- Простая анимация появления при скролле (AOS)
- Бэкенд: заявки сохраняются в SQLite. Эндпоинты:
	- `POST /api/request` — прямая заявка (без SMS)
	- `POST /api/captcha/new` — получить капчу (вопрос)
	- `POST /api/sms/send` — проверить капчу и выслать код (логируем в консоль)
	- `POST /api/sms/verify` — подтвердить код и создать заявку
	- `GET /api/requests` — список последних

Заметки:
- Шрифт Circe является проприетарным; в демо подключён Inter как замена. Для 100% сходства подключите лицензированный Circe.
- Цвета/радиусы/отступы вынесены в CSS-переменные для удобной настройки.

## Запуск с БД (Node.js)

Требуется Node.js 18+.

Windows PowerShell:

```powershell
cd server
npm install
npm start
```

После запуска откройте: http://localhost:8080

Эндпоинты:
- POST /api/request — тело JSON: { name?, phone (string), sum?, source?, extra? }
- GET /api/requests — посмотреть сохранённые заявки (до 100 последних)

SQLite база по умолчанию хранится в `server/data.sqlite`. При работе в Docker — в томе.

## Запуск в Docker

Windows PowerShell (Docker Desktop должен быть установлен и запущен):

```powershell
docker build -t zaim-service .
# Используем отдельный том только для файла БД, чтобы не перекрыть node_modules
docker volume create zaim-db
docker run --rm -p 8080:8080 -e DB_PATH=/data/data.sqlite -e SMS_ECHO=true -v zaim-db:/data zaim-service
```

Затем откройте: http://localhost:8080

Примечание: используем именованный том `zaim-db` только для файла БД (`/data/data.sqlite`), чтобы не перекрывать `node_modules` внутри контейнера.

## Docker Compose

Один скрипт для сборки и запуска:

```powershell
docker volume create zaim-db
docker compose up --build -d
# Логи
docker compose logs -f
```

По умолчанию поднимается http://localhost:8080. Переменные окружения:
- `DB_PATH=/data/data.sqlite` — путь к базе внутри контейнера
- `SMS_ECHO=true` — в DEV вывод кода в ответ API и логи (для удобства тестирования)

## Развёртывание на сервере

- Через Docker: скопируйте проект, выполните `docker build` и `docker run -p 80:8080`, проксируйте 80 порт (Nginx) при необходимости.
- Без Docker: установите Node, `cd server && npm i && npm start` (запускать под process manager — pm2/systemd), отдавайте статику тем же express (уже настроено).
