"""CRUD endpoints for Subjects."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.subject import Subject
from app.models.tenant import Tenant
from app.schemas.subject import SubjectCreate, SubjectOut, SubjectUpdate

router = APIRouter(prefix="/api/subjects", tags=["subjects"])


def _get_subject_or_404(db: Session, subject_id: int, tenant: Tenant) -> Subject:
    subject = db.get(Subject, subject_id)
    if subject is None or subject.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Subject {subject_id} not found")
    return subject


@router.get("", response_model=list[SubjectOut])
def list_subjects(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Subject]:
    return list(db.scalars(select(Subject).where(Subject.tenant_id == tenant.id).order_by(Subject.name)).all())


@router.get("/{subject_id}", response_model=SubjectOut)
def get_subject(subject_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Subject:
    return _get_subject_or_404(db, subject_id, tenant)


@router.post("", response_model=SubjectOut, status_code=status.HTTP_201_CREATED)
def create_subject(payload: SubjectCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Subject:
    subject = Subject(**payload.model_dump(), tenant_id=tenant.id)
    db.add(subject)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject name/code already exists") from exc
    db.refresh(subject)
    return subject


@router.put("/{subject_id}", response_model=SubjectOut)
def update_subject(subject_id: int, payload: SubjectUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Subject:
    subject = _get_subject_or_404(db, subject_id, tenant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(subject, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Subject name/code already exists") from exc
    db.refresh(subject)
    return subject


@router.delete("/{subject_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_subject(subject_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    subject = _get_subject_or_404(db, subject_id, tenant)
    db.delete(subject)
    db.commit()
