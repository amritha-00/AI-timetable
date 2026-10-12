"""CRUD endpoints for Periods (timeslots)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.period import Period
from app.models.tenant import Tenant
from app.schemas.period import PeriodCreate, PeriodOut, PeriodUpdate

router = APIRouter(prefix="/api/periods", tags=["periods"])


def _get_period_or_404(db: Session, period_id: int, tenant: Tenant) -> Period:
    period = db.get(Period, period_id)
    if period is None or period.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Period {period_id} not found")
    return period


@router.get("", response_model=list[PeriodOut])
def list_periods(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Period]:
    return list(db.scalars(select(Period).where(Period.tenant_id == tenant.id).order_by(Period.period_number)).all())


@router.get("/{period_id}", response_model=PeriodOut)
def get_period(period_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Period:
    return _get_period_or_404(db, period_id, tenant)


@router.post("", response_model=PeriodOut, status_code=status.HTTP_201_CREATED)
def create_period(payload: PeriodCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Period:
    period = Period(**payload.model_dump(), tenant_id=tenant.id)
    db.add(period)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Period number already exists") from exc
    db.refresh(period)
    return period


@router.put("/{period_id}", response_model=PeriodOut)
def update_period(period_id: int, payload: PeriodUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Period:
    period = _get_period_or_404(db, period_id, tenant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(period, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Period number already exists") from exc
    db.refresh(period)
    return period


@router.delete("/{period_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_period(period_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    period = _get_period_or_404(db, period_id, tenant)
    db.delete(period)
    db.commit()
