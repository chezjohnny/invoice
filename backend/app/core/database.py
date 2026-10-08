from collections.abc import Generator
from typing import Any

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import settings
from app.core.search import sqlite_phone_key, sqlite_search_key

# FastAPI runs a sync route and its dependencies in its threadpool, not always
# on the same thread: a connection may be used by another thread than the one
# that opened it (never by two at once, one session per request).
engine = create_engine(settings.database_url, echo=False, connect_args={"check_same_thread": False})


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


event.listen(engine, "connect", configure_sqlite_connection)

SessionLocal = sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def get_db() -> Generator[Session]:
    with SessionLocal() as session:
        yield session
