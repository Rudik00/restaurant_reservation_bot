import os

from dotenv import load_dotenv
from aiogram.types import (
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    Message,
    WebAppInfo,
)


async def show_info(message: Message):
    load_dotenv()
    mini_app_url = os.getenv("MINI_APP_URL")

    if not mini_app_url:
        await message.answer("MINI_APP_URL не настроен.")
        return

    keyboard = InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="Открыть бронирование",
                    web_app=WebAppInfo(url=mini_app_url),
                )
            ]
        ]
    )

    await message.answer(
        "Чтобы забронировать столик, откройте Mini App по кнопке ниже.",
        reply_markup=keyboard,
    )
