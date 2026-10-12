"""
SQLAlchemy engine and session management.

Uses MySQL through PyMySQL, pointed at the local XAMPP instance by default
(see `.env`). `pool_pre_ping` guards against a MySQL service dropping idle
connections - XAMPP locally, and just as importantly a cloud host (e.g.
Aiven) recycling idle connections on its end.
"""
from collections.abc import Generator

from sqlalchemy import create_engine, make_url
from sqlalchemy.orm import DeclarativeBase, sessionmaker

from app.config import settings

# A managed MySQL host (Aiven, PlanetScale, etc.) requires TLS; PyMySQL only
# enables it when told to via connect_args, not via a URL query string. Local
# XAMPP has no TLS listener, so this only kicks in for a non-localhost host -
# resolved from the actual connection URL (not just `db_host`, since a
# deployed environment sets `DATABASE_URL` directly and leaves `db_host` at
# its unused default).
_resolved_host = make_url(settings.sqlalchemy_database_url).host
_connect_args = {} if _resolved_host in ("localhost", "127.0.0.1", None) else {"ssl": {"ssl": {}}}

engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
    pool_recycle=3600,
    connect_args=_connect_args,
    echo=settings.app_debug and settings.app_env == "development",
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


class Base(DeclarativeBase):
    """Shared declarative base for all ORM models."""
    pass


def get_db() -> Generator:
    """FastAPI dependency that yields a DB session and always closes it."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
