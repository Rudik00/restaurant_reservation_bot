# Restaurant Reservation Bot

Telegram-бот и Mini App для бронирования столиков в ресторане.

Проект состоит из:
- FastAPI backend (API + раздача фронтенда)
- Telegram-бота на aiogram
- PostgreSQL базы данных (SQLAlchemy async)
- фронтенда на vanilla JS (Telegram Mini App)

## Возможности

- Бронирование столика через Mini App
- Проверка доступности столов с учетом времени и буфера занятости (2.5 часа)
- Фильтрация столов по вместимости (`max_people >= guests`)
- Просмотр своих броней пользователем
- Отмена своей брони
- Автоочистка устаревших броней
- Режим мастера (`mode=master`) с просмотром всех броней (группировка по дате и времени)
- Уведомления мастерам о новых бронях с кликабельной ссылкой для связи с клиентом

## Структура проекта

```
app/                # FastAPI приложение
database/           # ORM модели и инициализация БД
frontend/           # Mini App (HTML/CSS/JS)
telegrem_bot/       # Telegram-бот (aiogram)
```

## Требования

- Python 3.10+
- PostgreSQL
- Доступный HTTPS URL для Mini App (например, через ngrok)

## Установка

1. Клонируйте репозиторий и перейдите в папку проекта.
2. Создайте и активируйте виртуальное окружение.
3. Установите зависимости:

```bash
pip install -r requirements.txt
```

## Переменные окружения

Создайте файл `.env` в корне проекта:

```env
DATABASE_URL=postgresql+asyncpg://USER:PASSWORD@HOST:5432/DB_NAME
TELEGRAM_BOT_TOKEN=123456:ABCDEF...
MINI_APP_URL=https://your-public-url
```

Важно:
- `MINI_APP_URL` используется в командах бота `/info` и `/reserv_users`
- в `frontend/index.html` есть `window.BOOKING_API_URL`, его тоже нужно обновлять на актуальный публичный URL backend

## Подготовка БД

Таблицы создаются автоматически при запуске бота (вызов `init_db()`).

Также при старте бота выполняется `populate_default_tables()` и добавляются дефолтные столы:
- `S1-S14` (по 4 гостя)
- `R1-R4` (по 4 гостя)
- `R5-R6` (по 2 гостя)
- `VIP` (8 гостей)

Если база создавалась ранее, и у вас стояло ограничение уникальности на `users.telegram_id`, уберите его один раз:

```sql
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_telegram_id_key;
```

## Запуск

Запустите backend (FastAPI):

```bash
uvicorn app.main:app --reload --port 8000
```

Запустите бота (в отдельном терминале):

```bash
python -m telegrem_bot.main_bot
```

После этого:
- API доступен на `http://localhost:8000`
- фронтенд также открывается через этот же адрес (раздается FastAPI)

## Команды бота

- `/start` - приветствие
- `/info` - кнопка открытия пользовательского Mini App
- `/add_master` - добавить текущего пользователя в таблицу мастеров
- `/reserv_users` - открыть мастер-меню (только для мастеров)

## API (основные эндпоинты)

- `GET /api/availability`
	- параметры: `date`, опционально `hour`, `minute`, `guests`
	- если указано время, возвращаются `unavailable_tables` и `eligible_tables`

- `POST /api/booking`
	- создание брони
	- отправляет подтверждение пользователю и уведомление мастерам

- `GET /api/my-bookings?telegram_id=...`
	- возвращает активные брони пользователя, отсортированные от ближайшей к дальней

- `DELETE /api/my-bookings/{booking_id}?telegram_id=...`
	- отмена брони только владельцем

- `GET /api/master-bookings?telegram_id=...`
	- доступно только мастерам
	- возвращает все активные брони, сгруппированные по дате и времени

## Режимы фронтенда

- Обычный режим: `MINI_APP_URL`
- Мастер-режим: `MINI_APP_URL?mode=master`

Загрузка режима происходит в `frontend/app.js`, который подключает:
- `frontend/user.js` для пользователя
- `frontend/master.js` для мастера

## Частые проблемы

- Mini App не открывается:
	- проверьте `MINI_APP_URL` в `.env` (нужен HTTPS)

- Фронтенд не видит backend:
	- проверьте `window.BOOKING_API_URL` в `frontend/index.html`

- Нет уведомлений от бота:
	- проверьте `TELEGRAM_BOT_TOKEN`
	- убедитесь, что бот запущен

- Нет записей в мастер-меню:
	- добавьте мастер-аккаунт через `/add_master`

## Примечание

Название папки `telegrem_bot` и файла `madels_db.py` оставлены как есть, чтобы не ломать текущие импорты и запуск.
