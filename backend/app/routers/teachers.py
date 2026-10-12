"""CRUD endpoints for Teachers, plus subject-qualification management."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, selectinload

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.tenant import Tenant
from app.models.teacher_subject import TeacherSubject
from app.schemas.teacher import TeacherCreate, TeacherOut, TeacherSubjectAssign, TeacherUpdate
from app.schemas.teacher_subject import TeacherSubjectOut

router = APIRouter(prefix="/api/teachers", tags=["teachers"])


def _get_teacher_or_404(db: Session, teacher_id: int, tenant: Tenant) -> Teacher:
    teacher = db.get(Teacher, teacher_id)
    if teacher is None or teacher.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Teacher {teacher_id} not found")
    return teacher


@router.get("", response_model=list[TeacherOut])
def list_teachers(active_only: bool = False, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Teacher]:
    stmt = select(Teacher).where(Teacher.tenant_id == tenant.id).options(selectinload(Teacher.teacher_subjects))
    if active_only:
        stmt = stmt.where(Teacher.is_active.is_(True))
    return list(db.scalars(stmt.order_by(Teacher.name)).all())


@router.get("/{teacher_id}", response_model=TeacherOut)
def get_teacher(teacher_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Teacher:
    teacher = db.scalars(
        select(Teacher).where(Teacher.id == teacher_id).options(selectinload(Teacher.teacher_subjects))
    ).first()
    if teacher is None or teacher.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Teacher {teacher_id} not found")
    return teacher


@router.post("", response_model=TeacherOut, status_code=status.HTTP_201_CREATED)
def create_teacher(payload: TeacherCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Teacher:
    teacher = Teacher(**payload.model_dump(), tenant_id=tenant.id)
    db.add(teacher)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Teacher email already exists") from exc
    db.refresh(teacher)
    return teacher


@router.put("/{teacher_id}", response_model=TeacherOut)
def update_teacher(teacher_id: int, payload: TeacherUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Teacher:
    teacher = _get_teacher_or_404(db, teacher_id, tenant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(teacher, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Teacher email already exists") from exc
    db.refresh(teacher)
    return teacher


@router.delete("/{teacher_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_teacher(teacher_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    teacher = _get_teacher_or_404(db, teacher_id, tenant)
    db.delete(teacher)
    db.commit()


@router.get("/{teacher_id}/subjects", response_model=list[TeacherSubjectOut])
def list_teacher_subjects(teacher_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[TeacherSubject]:
    _get_teacher_or_404(db, teacher_id, tenant)
    stmt = select(TeacherSubject).where(TeacherSubject.teacher_id == teacher_id)
    return list(db.scalars(stmt).all())


@router.put("/{teacher_id}/subjects", response_model=list[TeacherSubjectOut])
def set_teacher_subjects(
    teacher_id: int, payload: TeacherSubjectAssign, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> list[TeacherSubject]:
    """Replace the full set of subjects this teacher is qualified to teach."""
    _get_teacher_or_404(db, teacher_id, tenant)

    existing_subject_ids = set(payload.subject_ids)
    if existing_subject_ids:
        found = set(db.scalars(select(Subject.id).where(Subject.id.in_(existing_subject_ids), Subject.tenant_id == tenant.id)).all())
        missing = existing_subject_ids - found
        if missing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Unknown subject id(s): {sorted(missing)}",
            )

    db.query(TeacherSubject).filter(TeacherSubject.teacher_id == teacher_id).delete()
    links = [TeacherSubject(teacher_id=teacher_id, subject_id=sid) for sid in existing_subject_ids]
    db.add_all(links)
    db.commit()

    stmt = select(TeacherSubject).where(TeacherSubject.teacher_id == teacher_id)
    return list(db.scalars(stmt).all())
