import os
import asyncio

from dotenv import load_dotenv
from aiogram import Bot, Dispatcher
from aiogram.filters import Command
from aiogram.fsm.storage.memory import MemoryStorage
from aiogram.types import Message

from .start_command import show_start
from .info_command import show_info

dp = Dispatcher(storage=MemoryStorage())


#                                     Общие команды для всех пользователей
# Команда для начала общения с ботом
@dp.message(Command("start"))
async def start_command(message: Message):
    await show_start(message)


# Команда для получения информации о боте, подробной инструкции
# Вывод ссылок для работы с ботом через мини апп
@dp.message(Command("info"))
async def info_command(message: Message):
    await show_info(message)


#                                   Команды для ресторана
# Команда для получения информации о боте
@dp.message(Command("reserv_users"))
async def reserv_users_command(message: Message):
    await message.answer(
        "Пока что эта команда в разработке, скоро будет готова)"
    )
    # await show_info(message)


def get_token() -> str:
    load_dotenv()  # читает .env
    token = os.getenv("TELEGRAM_BOT_TOKEN")
    if not token:
        raise ValueError("TELEGRAM_BOT_TOKEN не найден в .env")
    return token


async def main_tg_bot(token: str):
    # Запускаем polling и гарантированно закрываем сессию бота.
    bot = Bot(token=token)
    try:
        await dp.start_polling(bot)
    finally:
        await bot.session.close()


if __name__ == "__main__":
    token = get_token()
    asyncio.run(main_tg_bot(token))
