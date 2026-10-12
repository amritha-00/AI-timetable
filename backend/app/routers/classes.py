"""CRUD endpoints for School Classes (grade + section)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.school_class import SchoolClass
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.schemas.school_class import SchoolClassCreate, SchoolClassOut, SchoolClassUpdate

router = APIRouter(prefix="/api/classes", tags=["classes"])


def _get_class_or_404(db: Session, class_id: int, tenant: Tenant) -> SchoolClass:
    school_class = db.get(SchoolClass, class_id)
    if school_class is None or school_class.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Class {class_id} not found")
    return school_class


def _validate_class_teacher(db: Session, class_teacher_id: int | None, tenant: Tenant) -> None:
    if class_teacher_id is not None:
        teacher = db.get(Teacher, class_teacher_id)
        if teacher is None or teacher.tenant_id != tenant.id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST, detail=f"Teacher {class_teacher_id} not found"
            )


@router.get("", response_model=list[SchoolClassOut])
def list_classes(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[SchoolClass]:
    stmt = (
        select(SchoolClass)
        .where(SchoolClass.tenant_id == tenant.id)
        .options(joinedload(SchoolClass.class_teacher))
        .order_by(SchoolClass.grade, SchoolClass.section)
    )
    return list(db.scalars(stmt).all())


@router.get("/{class_id}", response_model=SchoolClassOut)
def get_class(class_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> SchoolClass:
    return _get_class_or_404(db, class_id, tenant)


@router.post("", response_model=SchoolClassOut, status_code=status.HTTP_201_CREATED)
def create_class(payload: SchoolClassCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> SchoolClass:
    _validate_class_teacher(db, payload.class_teacher_id, tenant)
    school_class = SchoolClass(**payload.model_dump(), tenant_id=tenant.id)
    db.add(school_class)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A class with this grade and section already exists"
        ) from exc
    db.refresh(school_class)
    return school_class


@router.put("/{class_id}", response_model=SchoolClassOut)
def update_class(class_id: int, payload: SchoolClassUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> SchoolClass:
    school_class = _get_class_or_404(db, class_id, tenant)
    data = payload.model_dump(exclude_unset=True)
    if "class_teacher_id" in data:
        _validate_class_teacher(db, data["class_teacher_id"], tenant)
    for field, value in data.items():
        setattr(school_class, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A class with this grade and section already exists"
        ) from exc
    db.refresh(school_class)
    return school_class


@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_class(class_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    school_class = _get_class_or_404(db, class_id, tenant)
    db.delete(school_class)
    db.commit()
