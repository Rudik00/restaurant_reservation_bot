from sqlalchemy import (
    Column,
    BigInteger,
    Integer,
    String,
)
from sqlalchemy.orm import declarative_base


Base = declarative_base()


class Tables(Base):
    __tablename__ = "tables"
    id = Column(Integer, primary_key=True)
    number_table = Column(String, unique=True, nullable=False)
    max_people = Column(Integer, nullable=False)
    data_reservation = Column(String, nullable=True)


class Users(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True)
    telegram_id = Column(BigInteger, unique=True, nullable=False)
    tg_name = Column(String, nullable=False)
    name = Column(String, nullable=False)
    adress_restorant = Column(String, nullable=False)
    data_reservation = Column(String, nullable=False)
    time_reservation = Column(String, nullable=False)
    num_table = Column(String, nullable=False)
    people_count = Column(Integer, nullable=False)
    phone_number = Column(String, nullable=False)
