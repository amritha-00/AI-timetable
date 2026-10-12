"""
Create all tables from the SQLAlchemy models (mirrors database/schema.sql).

Use this for a quick local dev setup without phpMyAdmin. It assumes the
`timetable_ai` database already exists (create it once in phpMyAdmin or via
`mysql -u root -e "CREATE DATABASE timetable_ai"`).

Run from the `backend/` directory:
    python scripts/create_tables.py
"""
import sys
from pathlib import Path

# Allow running as `python scripts/create_tables.py` without installing the package
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.db.session import Base, engine
from app import models  # noqa: F401 - populates Base.metadata


def main() -> None:
    print(f"Creating tables on: {engine.url}")
    Base.metadata.create_all(bind=engine)
    print("Done. Tables created (existing tables were left untouched).")


if __name__ == "__main__":
    main()
