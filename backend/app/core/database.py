from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy import event
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.core.config import settings
from app.core.search import sqlite_phone_key, sqlite_search_key

engine = create_async_engine(settings.database_url, echo=False)


def configure_sqlite_connection(dbapi_conn: Any, _record: Any) -> None:
    dbapi_conn.create_function("search_key", 1, sqlite_search_key, deterministic=True)
    dbapi_conn.create_function("phone_key", 1, sqlite_phone_key, deterministic=True)
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    # WAL: readers no longer wait for a writer, and it survives a crash mid-write.
    # Persistent in the file; NORMAL sync is durable enough under WAL and faster.
    cursor.execute("PRAGMA journal_mode=WAL")
    cursor.execute("PRAGMA synchronous=NORMAL")
    # Wait for a concurrent writer's lock instead of failing with "database is locked".
    cursor.execute("PRAGMA busy_timeout=5000")
    cursor.close()


if settings.database_url.startswith("sqlite"):
    event.listen(engine.sync_engine, "connect", configure_sqlite_connection)

AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
