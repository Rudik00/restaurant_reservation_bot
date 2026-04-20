import os
from dotenv import load_dotenv

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy.dialects.postgresql import insert
from .madels_db import Base
from .madels_db import Tables

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")


# id от 1 до 14 name_tsble S1 - S14 max_people 4
# id 15-18 name_table R1 - R4 max_people 4
# id 19-20 name_table R5 - R6 max_people 2
# id 21 name_table VIP max_people 8
#
_DEFAULT_TABLES = [
    {"number_table": f"S{i}", "max_people": 4} for i in range(1, 15)
] + [
    {"number_table": f"R{i}", "max_people": 4} for i in range(1, 5)
] + [
    {"number_table": f"R{i}", "max_people": 2} for i in range(5, 7)
] + [
    {"number_table": "VIP", "max_people": 8}
]


async def populate_default_tables():
    database_url = DATABASE_URL
    engine = create_async_engine(database_url, echo=False)
    async with engine.begin() as conn:
        for table in _DEFAULT_TABLES:
            statement = insert(Tables).values(**table)
            statement = statement.on_conflict_do_nothing(
                index_elements=[Tables.number_table]
            )
            await conn.execute(
                statement
            )
    await engine.dispose()


async def init_db():
    database_url = DATABASE_URL
    engine = create_async_engine(database_url, echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    await engine.dispose()
