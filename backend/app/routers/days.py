"""CRUD endpoints for Days. Mostly read-only in practice (seeded once)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.day import Day
from app.models.tenant import Tenant
from app.schemas.day import DayCreate, DayOut, DayUpdate

router = APIRouter(prefix="/api/days", tags=["days"])


def _get_day_or_404(db: Session, day_id: int, tenant: Tenant) -> Day:
    day = db.get(Day, day_id)
    if day is None or day.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Day {day_id} not found")
    return day


@router.get("", response_model=list[DayOut])
def list_days(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Day]:
    return list(db.scalars(select(Day).where(Day.tenant_id == tenant.id).order_by(Day.order_index)).all())


@router.get("/{day_id}", response_model=DayOut)
def get_day(day_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Day:
    return _get_day_or_404(db, day_id, tenant)


@router.post("", response_model=DayOut, status_code=status.HTTP_201_CREATED)
def create_day(payload: DayCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Day:
    day = Day(**payload.model_dump(), tenant_id=tenant.id)
    db.add(day)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Day already exists") from exc
    db.refresh(day)
    return day


@router.put("/{day_id}", response_model=DayOut)
def update_day(day_id: int, payload: DayUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Day:
    day = _get_day_or_404(db, day_id, tenant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(day, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Day already exists") from exc
    db.refresh(day)
    return day


@router.delete("/{day_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_day(day_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    day = _get_day_or_404(db, day_id, tenant)
    db.delete(day)
    db.commit()
