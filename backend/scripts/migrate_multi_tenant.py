"""
One-off migration: introduces the `tenants` table and scopes every existing
table to a tenant.

Safe to run multiple times (every step checks before acting). Existing data
is kept - it's assigned to a newly created "Demo School" tenant (marked
`is_subscribed=True` so the demo/seed data is never paywalled), rather than
deleted.

Run from `backend/` with the venv active:
    python scripts/migrate_multi_tenant.py
"""
from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import inspect, text

from app import models  # noqa: F401 - populates Base.metadata
from app.auth import hash_password
from app.db.session import Base, SessionLocal, engine
from app.models.tenant import Tenant

TENANT_SCOPED_TABLES = [
    "teachers",
    "subjects",
    "classes",
    "rooms",
    "days",
    "periods",
    "constraints",
    "timetables",
]

DEMO_EMAIL = "demo@democlassroom.app"


def column_exists(table: str, column: str) -> bool:
    inspector = inspect(engine)
    if table not in inspector.get_table_names():
        return False
    return any(c["name"] == column for c in inspector.get_columns(table))


def main() -> None:
    inspector = inspect(engine)

    # 1. Create the `tenants` table (and any other new table) if missing.
    Base.metadata.create_all(bind=engine, tables=[Base.metadata.tables["tenants"]])

    db = SessionLocal()
    try:
        demo_tenant = db.query(Tenant).filter(Tenant.email == DEMO_EMAIL).first()
        if demo_tenant is None:
            demo_tenant = Tenant(
                school_name="Demo School",
                email=DEMO_EMAIL,
                password_hash=hash_password("demo12345"),
                is_subscribed=True,  # never paywalled - this is the pre-existing seeded data
            )
            db.add(demo_tenant)
            db.commit()
            db.refresh(demo_tenant)
            print(f"Created demo tenant #{demo_tenant.id} ({DEMO_EMAIL} / demo12345)")
        else:
            print(f"Demo tenant already exists: #{demo_tenant.id}")
        demo_id = demo_tenant.id
    finally:
        db.close()

    # 2. Add tenant_id to every pre-existing table that needs it, backfill
    # with the demo tenant, then enforce NOT NULL + FK.
    with engine.begin() as conn:
        for table in TENANT_SCOPED_TABLES:
            if table not in inspector.get_table_names():
                print(f"  (skip {table}: table doesn't exist yet)")
                continue
            if column_exists(table, "tenant_id"):
                print(f"  {table}.tenant_id already present")
                continue
            print(f"  altering {table}: add tenant_id")
            conn.execute(text(f"ALTER TABLE `{table}` ADD COLUMN tenant_id INT NULL"))
            conn.execute(text(f"UPDATE `{table}` SET tenant_id = :tid WHERE tenant_id IS NULL"), {"tid": demo_id})
            conn.execute(text(f"ALTER TABLE `{table}` MODIFY COLUMN tenant_id INT NOT NULL"))
            conn.execute(
                text(
                    f"ALTER TABLE `{table}` ADD CONSTRAINT fk_{table}_tenant "
                    f"FOREIGN KEY (tenant_id) REFERENCES tenants(id) ON DELETE CASCADE"
                )
            )

    # 3. Re-point the old global UNIQUE constraints at (tenant_id, ...) so
    # different tenants can both have a "Monday" or a "Room-101" etc.
    # MySQL names these from the original schema.sql; drop by introspecting.
    inspector = inspect(engine)
    # Old (pre-tenant) unique constraints to drop, identified by their exact
    # column set - never touches "tenant_id" so it can't accidentally drop
    # the new ones added in step 4.
    old_unique_column_sets = {
        "subjects": [{"name"}, {"code"}],
        "rooms": [{"name"}],
        "days": [{"name"}, {"order_index"}],
        "periods": [{"period_number"}],
        "teachers": [{"email"}],
        "classes": [{"grade", "section"}],
    }
    with engine.begin() as conn:
        for table, column_sets in old_unique_column_sets.items():
            if table not in inspector.get_table_names():
                continue
            for uc in inspector.get_unique_constraints(table):
                if set(uc["column_names"]) in column_sets:
                    print(f"  dropping old global unique {table}.{uc['name']} ({uc['column_names']})")
                    conn.execute(text(f"ALTER TABLE `{table}` DROP INDEX `{uc['name']}`"))

    # 4. Now that stale global uniques are gone, add the new tenant-scoped
    # ones (create_all only creates brand-new tables, it never alters an
    # existing table's constraints - so these have to be added explicitly,
    # matching each model's `__table_args__`).
    tenant_scoped_uniques = {
        "subjects": [("uq_tenant_subject_name", ["tenant_id", "name"]), ("uq_tenant_subject_code", ["tenant_id", "code"])],
        "rooms": [("uq_tenant_room_name", ["tenant_id", "name"])],
        "days": [("uq_tenant_day_name", ["tenant_id", "name"]), ("uq_tenant_day_order", ["tenant_id", "order_index"])],
        "periods": [("uq_tenant_period_number", ["tenant_id", "period_number"])],
        "teachers": [("uq_tenant_teacher_email", ["tenant_id", "email"])],
        "classes": [("uq_tenant_grade_section", ["tenant_id", "grade", "section"])],
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, constraints in tenant_scoped_uniques.items():
            if table not in inspector.get_table_names():
                continue
            existing_names = {uc["name"] for uc in inspector.get_unique_constraints(table)}
            for name, cols in constraints:
                if name in existing_names:
                    continue
                col_list = ", ".join(f"`{c}`" for c in cols)
                print(f"  adding unique {table}.{name} ({cols})")
                conn.execute(text(f"ALTER TABLE `{table}` ADD CONSTRAINT `{name}` UNIQUE ({col_list})"))

    # Base.metadata.create_all still handles any brand-new tables (e.g. if a
    # later model is added), harmlessly re-run.
    Base.metadata.create_all(bind=engine)
    print("Migration complete.")


if __name__ == "__main__":
    main()
