import os
import httpx

from datetime import datetime, timedelta
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel
from dotenv import load_dotenv
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from sqlalchemy import select, delete
from sqlalchemy.dialects.postgresql import insert

from database.madels_db import Master, Users, Tables

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")

engine = create_async_engine(DATABASE_URL, echo=False)
AsyncSessionLocal = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)

app = FastAPI(title="Restaurant Reservation API")

# Разрешаем запросы с фронтенда (Mini App)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["GET", "POST", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)


class BookingRequest(BaseModel):
    telegram_id: int  # Telegram user ID (64-bit)
    tg_name: str
    name: str
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


async def notify_masters_about_booking(data: BookingRequest, time_str: str) -> None:
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(select(Master.telegram_id))
            master_ids = [row[0] for row in result if row[0] is not None]
    except Exception:
        return

    if not master_ids:
        return

    tg_link = (
        f'<a href="https://t.me/{data.tg_name.lstrip("@")}">связь с клиентом</a>'
        if data.tg_name
        else f'<a href="tg://user?id={data.telegram_id}">связь с клиентом</a>'
    )
    text = (
        f"🆕 <b>Новая бронь</b>\n\n"
        f"📅 <b>Дата:</b> {data.date}\n"
        f"⏰ <b>Время:</b> {time_str}\n"
        f"👥 <b>Гостей:</b> {data.guests}\n"
        f"🪑 <b>Столик:</b> № {data.table}\n"
        f"👤 <b>Имя:</b> {data.name}\n"
        f"📞 <b>Телефон:</b> {data.phone}\n"
        f"🔗 {tg_link}"
    )

    for master_id in master_ids:
        try:
            await send_telegram_message(master_id, text)
        except Exception:
            continue


def _booking_start_datetime(date_str: str, time_str: str) -> datetime:
    date_obj = datetime.strptime(date_str, "%Y-%m-%d")
    hour_str, minute_str = time_str.split(":")
    hour = int(hour_str)
    minute = int(minute_str)
    start_dt = date_obj.replace(hour=hour, minute=minute, second=0, microsecond=0)

    # Ночные слоты относятся к следующему календарному дню сервиса.
    if hour <= 2:
        start_dt = start_dt + timedelta(days=1)

    return start_dt


@app.get("/api/availability")
async def check_availability(
    date: str,
    hour: str = None,
    minute: str = None,
    guests: int = None,
):
    """
    Проверяет доступность столиков на дату и время.
    Возвращает список недоступных столиков с учётом +2.5 часа буфера.
    """
    try:
        query_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid date format. Use YYYY-MM-DD")

    async with AsyncSessionLocal() as session:
        # Получаем столики, которые подходят по вместимости.
        tables_query = select(Tables)
        if guests is not None:
            tables_query = tables_query.where(Tables.max_people >= guests)

        tables_result = await session.execute(tables_query)
        all_tables = tables_result.scalars().all()
        all_table_labels = {table.number_table for table in all_tables}

        # Если время не указано, просто проверяем есть ли вообще бронирования на дату
        if hour is None or minute is None:
            bookings = await session.execute(
                select(Users.num_table).where(Users.data_reservation == str(query_date))
            )
            booked_tables = {row[0] for row in bookings if row[0] in all_table_labels}
            fully_booked = len(all_tables) == 0 or len(booked_tables) >= len(all_tables)
            return {
                "date": date,
                "booked_tables": list(booked_tables),
                "eligible_tables": list(all_table_labels),
                "fully_booked": fully_booked,
                "total_tables": len(all_tables),
            }

        # Если время указано, проверяем конфликты с +2.5 часа буфера
        try:
            booking_hour = int(hour)
            booking_minute = int(minute)
            booking_time = datetime.combine(query_date, datetime.min.time()).replace(
                hour=booking_hour, minute=booking_minute
            )
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid time format")

        # Ищем бронирования на эту дату
        bookings = await session.execute(
            select(Users).where(Users.data_reservation == str(query_date))
        )
        existing_bookings = bookings.scalars().all()

        unavailable_tables = set()
        for booking in existing_bookings:
            try:
                parts = booking.time_reservation.split(":")
                existing_hour = int(parts[0])
                existing_minute = int(parts[1]) if len(parts) > 1 else 0

                existing_time = datetime.combine(query_date, datetime.min.time()).replace(
                    hour=existing_hour, minute=existing_minute
                )
                # +2.5 часа = +2.5 * 60 = +150 минут
                occupied_until = existing_time + timedelta(minutes=150)

                # Если новая бронь попадает в окно [existing_time, occupied_until], столик недоступен
                if (
                    existing_time <= booking_time < occupied_until
                    and booking.num_table in all_table_labels
                ):
                    unavailable_tables.add(booking.num_table)
            except (ValueError, AttributeError):
                pass

        fully_booked = len(all_tables) == 0 or len(unavailable_tables) >= len(all_tables)
        return {
            "date": date,
            "time": f"{hour}:{minute}",
            "unavailable_tables": list(unavailable_tables),
            "eligible_tables": list(all_table_labels),
            "fully_booked": fully_booked,
            "total_tables": len(all_tables),
        }


@app.post("/api/booking")
async def create_booking(data: BookingRequest):
    time_str = f"{data.hour}:{data.minute}"

    stmt = insert(Users).values(
        telegram_id=data.telegram_id,
        tg_name=data.tg_name,
        name=data.name,
        data_reservation=data.date,
        time_reservation=time_str,
        num_table=data.table,
        people_count=data.guests,
        phone_number=data.phone,
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
        f"📅 <b>Дата:</b> {data.date}\n"
        f"⏰ <b>Время:</b> {time_str}\n"
        f"👥 <b>Гостей:</b> {data.guests}\n"
        f"🪑 <b>Столик:</b> № {data.table}\n"
        f"👤 <b>Имя:</b> {data.name}\n"
        f"📞 <b>Телефон:</b> {data.phone}"
    )
    await send_telegram_message(data.telegram_id, confirmation)
    await notify_masters_about_booking(data, time_str)

    return {"status": "ok"}


@app.get("/api/my-bookings")
async def get_my_bookings(telegram_id: int):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Users)
                .where(Users.telegram_id == telegram_id)
                .order_by(Users.id.desc())
            )
            bookings = result.scalars().all()

            now = datetime.now()
            active_bookings = []
            outdated_ids = []

            for booking in bookings:
                try:
                    booking_start = _booking_start_datetime(
                        booking.data_reservation,
                        booking.time_reservation,
                    )
                except (ValueError, TypeError):
                    active_bookings.append(booking)
                    continue

                if booking_start < now:
                    outdated_ids.append(booking.id)
                else:
                    active_bookings.append(booking)

            if outdated_ids:
                await session.execute(
                    delete(Users).where(
                        Users.telegram_id == telegram_id,
                        Users.id.in_(outdated_ids),
                    )
                )
                await session.commit()

            active_bookings.sort(
                key=lambda booking: _booking_start_datetime(
                    booking.data_reservation,
                    booking.time_reservation,
                )
            )
            bookings = active_bookings
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    payload = [
        {
            "id": booking.id,
            "date": booking.data_reservation,
            "time": booking.time_reservation,
            "table": booking.num_table,
            "guests": booking.people_count,
            "name": booking.name,
            "phone": booking.phone_number,
        }
        for booking in bookings
    ]

    return {"bookings": payload}


@app.delete("/api/my-bookings/{booking_id}")
async def cancel_my_booking(booking_id: int, telegram_id: int):
    try:
        async with AsyncSessionLocal() as session:
            result = await session.execute(
                select(Users).where(
                    Users.id == booking_id,
                    Users.telegram_id == telegram_id,
                )
            )
            booking = result.scalar_one_or_none()

            if booking is None:
                raise HTTPException(status_code=404, detail="Booking not found")

            await session.execute(
                delete(Users).where(
                    Users.id == booking_id,
                    Users.telegram_id == telegram_id,
                )
            )
            await session.commit()
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    return {"status": "ok", "deleted_id": booking_id}


@app.get("/api/master-bookings")
async def get_master_bookings(telegram_id: int):
    try:
        async with AsyncSessionLocal() as session:
            master_result = await session.execute(
                select(Master.id).where(Master.telegram_id == telegram_id)
            )
            is_master = master_result.scalar_one_or_none() is not None

            if not is_master:
                raise HTTPException(status_code=403, detail="Access denied")

            bookings_result = await session.execute(select(Users))
            bookings = bookings_result.scalars().all()

            now = datetime.now()
            active_bookings = []
            outdated_ids = []

            for booking in bookings:
                try:
                    booking_start = _booking_start_datetime(
                        booking.data_reservation,
                        booking.time_reservation,
                    )
                except (ValueError, TypeError):
                    continue

                if booking_start < now:
                    outdated_ids.append(booking.id)
                else:
                    active_bookings.append(booking)

            if outdated_ids:
                await session.execute(delete(Users).where(Users.id.in_(outdated_ids)))
                await session.commit()

            grouped = {}
            for booking in active_bookings:
                date_key = booking.data_reservation
                time_key = booking.time_reservation
                grouped.setdefault(date_key, {})
                grouped[date_key].setdefault(time_key, [])
                grouped[date_key][time_key].append(
                    {
                        "id": booking.id,
                        "table": booking.num_table,
                        "guests": booking.people_count,
                        "name": booking.name,
                        "phone": booking.phone_number,
                        "telegram_id": booking.telegram_id,
                        "tg_name": booking.tg_name,
                    }
                )

            groups = []
            for date_key in sorted(grouped.keys()):
                time_groups = []
                for time_key in sorted(grouped[date_key].keys()):
                    time_groups.append(
                        {
                            "time": time_key,
                            "bookings": grouped[date_key][time_key],
                        }
                    )

                if time_groups:
                    groups.append(
                        {
                            "date": date_key,
                            "times": time_groups,
                        }
                    )
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"DB error: {e}")

    return {"groups": groups}


# Раздаём фронтенд — монтируем ПОСЛЕ всех API-роутов
_FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "..", "frontend")
app.mount("/", StaticFiles(directory=_FRONTEND_DIR, html=True), name="frontend")
