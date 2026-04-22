import os

from dotenv import load_dotenv
from aiogram.types import InlineKeyboardButton, InlineKeyboardMarkup, Message, WebAppInfo
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import create_async_engine

from database.madels_db import Master


async def add_master(message: Message):
    if message.from_user is None:
        await message.answer("Не удалось определить пользователя.")
        return

    load_dotenv()
    database_url = os.getenv("DATABASE_URL")

    engine = create_async_engine(database_url, echo=False)
    try:
        async with engine.begin() as conn:
            statement = insert(Master).values(telegram_id=message.from_user.id)
            statement = statement.on_conflict_do_nothing(
                index_elements=[Master.telegram_id]
            )
            await conn.execute(statement)
    finally:
        await engine.dispose()

    await message.answer("Вы добавлены в базу мастеров.")


async def show_master_reservations(message: Message):
    if message.from_user is None:
        await message.answer("Не удалось определить пользователя.")
        return

    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    mini_app_url = os.getenv("MINI_APP_URL")

    if not mini_app_url:
        await message.answer("MINI_APP_URL не настроен.")
        return

    engine = create_async_engine(database_url, echo=False)
    is_master = False
    try:
        async with engine.connect() as conn:
            result = await conn.execute(
                select(Master.id).where(Master.telegram_id == message.from_user.id)
            )
            is_master = result.scalar_one_or_none() is not None
    finally:
        await engine.dispose()

    if not is_master:
        await message.answer("У вас нет прав для просмотра мастер-меню.")
        return

    separator = "&" if "?" in mini_app_url else "?"
    master_url = f"{mini_app_url}{separator}mode=master"

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть мастер-меню",
                    web_app=WebAppInfo(url=master_url),
                )
            ]
        ]
    )

    await message.answer(
        "Откройте Mini App для просмотра всех бронирований.",
        reply_markup=keyboard,
    )
