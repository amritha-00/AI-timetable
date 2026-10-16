"""
Adds the two Stripe columns to `tenants` (stripe_customer_id,
stripe_subscription_id) - needed once per database that predates the
billing module. Safe to run multiple times; skips columns that already
exist.

Run locally (uses .env's DATABASE_URL/DB_* as-is):
    python scripts/migrate_billing_columns.py

Or against a cloud database (prompts for the password, never logs it):
    python scripts/migrate_billing_columns.py --cloud
"""
from __future__ import annotations

import argparse
import getpass
import sys
from pathlib import Path
from urllib.parse import quote_plus

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import create_engine, text


def migrate(engine) -> None:
    with engine.begin() as conn:
        cols = [r[0] for r in conn.execute(text("SHOW COLUMNS FROM tenants")).fetchall()]
        for col, ddl in [
            ("stripe_customer_id", "ALTER TABLE tenants ADD COLUMN stripe_customer_id VARCHAR(100) NULL UNIQUE"),
            ("stripe_subscription_id", "ALTER TABLE tenants ADD COLUMN stripe_subscription_id VARCHAR(100) NULL UNIQUE"),
        ]:
            if col in cols:
                print(f"{col} already exists, skipping")
            else:
                conn.execute(text(ddl))
                print(f"added {col}")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--cloud", action="store_true", help="prompt for cloud DB connection details instead of using .env")
    args = parser.parse_args()

    if args.cloud:
        host = input("Host: ").strip()
        port = input("Port: ").strip()
        user = input("User (usually avnadmin): ").strip() or "avnadmin"
        database = input("Database name (usually defaultdb): ").strip() or "defaultdb"
        password = getpass.getpass("Password (hidden): ").strip()
        url = f"mysql+pymysql://{user}:{quote_plus(password)}@{host}:{port}/{database}"
        engine = create_engine(url, connect_args={"ssl": {"ssl": {}}})
    else:
        from app.db.session import engine

    migrate(engine)
    print("Done.")


if __name__ == "__main__":
    main()
