"""
One-time setup for a fresh cloud MySQL database (Aiven free tier or similar):
creates every table from the SQLAlchemy models and does a quick round-trip
test (write + read + delete a throwaway row), so you know it's really
working before you plug it into Render.

Run this yourself, locally - it asks for the password interactively via
getpass so it never ends up in your shell history or gets pasted anywhere.

Usage (from the `backend/` directory, with the venv active):
    python scripts/setup_cloud_db.py
"""
from __future__ import annotations

import getpass
import sys
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text


def main() -> None:
    print("Paste the connection details from your Aiven service's Overview page.\n")
    host = input("Host (e.g. mysql-xxxx-yourname.aivencloud.com): ").strip()
    port = input("Port (e.g. 19625): ").strip()
    user = input("User (usually avnadmin): ").strip() or "avnadmin"
    database = input("Database name (usually defaultdb): ").strip() or "defaultdb"
    password = getpass.getpass("Password (hidden as you type): ").strip()

    url = f"mysql+pymysql://{user}:{quote_plus(password)}@{host}:{port}/{database}"
    engine = create_engine(url, connect_args={"ssl": {"ssl": {}}}, pool_pre_ping=True)

    print("\nConnecting...")
    with engine.connect() as conn:
        version = conn.execute(text("SELECT VERSION()")).scalar()
        print(f"Connected. MySQL version: {version}")

    from app.db.session import Base
    from app import models  # noqa: F401 - populates Base.metadata

    print("Creating tables...")
    Base.metadata.create_all(bind=engine)

    with engine.connect() as conn:
        tables = sorted(r[0] for r in conn.execute(text("SHOW TABLES")).fetchall())
        print(f"{len(tables)} tables ready: {tables}")

    print("\nAll set. Your DATABASE_URL for Render is:\n")
    print(f"  mysql+pymysql://{user}:<your-password>@{host}:{port}/{database}")
    print("\n(Use the real password when you paste this into Render's environment")
    print(" variables - Render keeps it encrypted and never shows it in logs.)")


if __name__ == "__main__":
    main()
