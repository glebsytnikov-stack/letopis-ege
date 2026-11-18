"""Telegram-бот-оболочка для Mini App «Летопись».

Бот открывает ту же PWA-игру внутри Telegram. Сама учебная логика находится
во фронтенде; прогресс сохраняется локально в браузере пользователя.
"""
import asyncio
import logging
import os
import sys
from urllib.parse import urlparse

from aiogram import Bot, Dispatcher, F
from aiogram.filters import Command, CommandStart
from aiogram.types import (
    BotCommand,
    InlineKeyboardButton,
    InlineKeyboardMarkup,
    MenuButtonWebApp,
    Message,
    WebAppInfo,
)
from dotenv import load_dotenv

load_dotenv()
BOT_TOKEN = os.getenv("BOT_TOKEN", "").strip()
WEBAPP_URL = os.getenv("WEBAPP_URL", "").strip()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
)
logger = logging.getLogger("letopis-bot")


def validate_config() -> None:
    if not BOT_TOKEN or "PASTE_YOUR" in BOT_TOKEN:
        raise RuntimeError("Укажи настоящий BOT_TOKEN в файле .env")
    if not WEBAPP_URL or "YOUR_USERNAME" in WEBAPP_URL:
        raise RuntimeError("Укажи WEBAPP_URL в файле .env")
    parsed = urlparse(WEBAPP_URL)
    if parsed.scheme != "https" or not parsed.netloc:
        raise RuntimeError("WEBAPP_URL должен быть публичным HTTPS-адресом")


def app_keyboard() -> InlineKeyboardMarkup:
    return InlineKeyboardMarkup(
        inline_keyboard=[
            [
                InlineKeyboardButton(
                    text="📜 Открыть Летопись",
                    web_app=WebAppInfo(url=WEBAPP_URL),
                )
            ]
        ]
    )


async def main() -> None:
    validate_config()
    bot = Bot(token=BOT_TOKEN)
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def start_handler(message: Message) -> None:
        await message.answer(
            "📜 <b>Добро пожаловать в Летопись!</b>\n\n"
            "Твой тренажёр ЕГЭ по истории: даты, термины, правители, войны, "
            "культура и исторические схемы.\n\n"
            "Открой приложение и продолжай свой путь летописца.",
            reply_markup=app_keyboard(),
            parse_mode="HTML",
        )

    @dp.message(Command("app"))
    async def app_handler(message: Message) -> None:
        await message.answer(
            "Нажми кнопку, чтобы открыть тренажёр 👇",
            reply_markup=app_keyboard(),
        )

    @dp.message(Command("help"))
    async def help_handler(message: Message) -> None:
        await message.answer(
            "<b>Команды Летописи</b>\n"
            "/start — открыть приложение\n"
            "/app — открыть тренажёр\n"
            "/help — эта подсказка\n\n"
            "Внутри приложения доступны карточки, тесты, хронология и схемы.",
            reply_markup=app_keyboard(),
            parse_mode="HTML",
        )

    @dp.message(F.web_app_data)
    async def web_app_data_handler(message: Message) -> None:
        # В текущей версии игра не отправляет персональные данные боту.
        # Обработчик оставлен для будущей интеграции результатов тренировок.
        logger.info("Получено событие Web App Data от user_id=%s", message.from_user.id if message.from_user else "unknown")
        await message.answer("Данные от приложения получены. Хорошей подготовки! 📚")

    await bot.set_my_commands(
        [
            BotCommand(command="start", description="Открыть Летопись"),
            BotCommand(command="app", description="Запустить тренажёр"),
            BotCommand(command="help", description="Помощь"),
        ]
    )
    try:
        await bot.set_chat_menu_button(
            menu_button=MenuButtonWebApp(
                text="Летопись",
                web_app=WebAppInfo(url=WEBAPP_URL),
            )
        )
    except Exception as exc:  # Не мешаем запуску, если Telegram не разрешил кнопку меню.
        logger.warning("Не удалось установить кнопку меню бота: %s", exc)

    logger.info("Бот запущен. Mini App: %s", WEBAPP_URL)
    try:
        await dp.start_polling(bot, allowed_updates=dp.resolve_used_update_types())
    finally:
        await bot.session.close()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        sys.exit(0)
    except Exception as error:
        logger.error("Ошибка запуска: %s", error)
        sys.exit(1)
