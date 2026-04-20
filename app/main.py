import os
import httpx

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy.dialects.postgresql import insert

from database.madels_db import Users

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
MINI_APP_URL = os.getenv("MINI_APP_URL", "")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

app = FastAPI(title="Restaurant Reservation API")

# Разрешаем запросы с фронтенда (Mini App)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["POST", "OPTIONS"],
    allow_headers=["*"],
)


class BookingRequest(BaseModel):
    telegram_id: int  # Telegram user ID (64-bit)
    tg_name: str
    name: str
    address: str
    date: str
    hour: str
    minute: str
    guests: int
    table: str
    phone: str


async def send_telegram_message(chat_id: int, text: str) -> None:
    url = f"https://api.telegram.org/bot{BOT_TOKEN}/sendMessage"
    async with httpx.AsyncClient() as client:
        await client.post(url, json={"chat_id": chat_id, "text": text, "parse_mode": "HTML"})


@app.post("/api/booking")
async def create_booking(data: BookingRequest):
    time_str = f"{data.hour}:{data.minute}"

    stmt = (
        insert(Users)
        .values(
            telegram_id=data.telegram_id,
            tg_name=data.tg_name,
            name=data.name,
            adress_restorant=data.address,
            data_reservation=data.date,
            time_reservation=time_str,
            num_table=data.table,
            people_count=data.guests,
            phone_number=data.phone,
        )
        .on_conflict_do_update(
            index_elements=[Users.telegram_id],
            set_={
                "name": data.name,
                "adress_restorant": data.address,
                "data_reservation": data.date,
                "time_reservation": time_str,
                "num_table": data.table,
                "people_count": data.guests,
                "phone_number": data.phone,
                "tg_name": data.tg_name,
            },
        )
    )

    try:
        async with AsyncSessionLocal() as session:
            async with session.begin():
                await session.execute(stmt)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    # Отправляем подтверждение пользователю в Telegram
    confirmation = (
        f"✅ <b>Бронь подтверждена!</b>\n\n"
        f"📍 <b>Адрес:</b> {data.address}\n"
        f"📅 <b>Дата:</b> {data.date}\n"
        f"⏰ <b>Время:</b> {time_str}\n"
        f"👥 <b>Гостей:</b> {data.guests}\n"
        f"🪑 <b>Столик:</b> № {data.table}\n"
        f"👤 <b>Имя:</b> {data.name}\n"
        f"📞 <b>Телефон:</b> {data.phone}"
    )
    await send_telegram_message(data.telegram_id, confirmation)

    return {"status": "ok"}


# Раздаём фронтенд — монтируем ПОСЛЕ всех API-роутов
_FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
