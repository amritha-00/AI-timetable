"""CRUD endpoints for ClassSubjectRequirement (periods/week, and optionally
a pinned teacher, per class+subject)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.class_subject_requirement import ClassSubjectRequirement
from app.models.school_class import SchoolClass
from app.models.subject import Subject
from app.models.teacher import Teacher
from app.models.teacher_subject import TeacherSubject
from app.models.tenant import Tenant
from app.schemas.requirement import RequirementCreate, RequirementOut, RequirementUpdate

router = APIRouter(prefix="/api/requirements", tags=["requirements"])


def _get_requirement_or_404(db: Session, requirement_id: int, tenant: Tenant) -> ClassSubjectRequirement:
    req = db.scalars(
        select(ClassSubjectRequirement)
        .join(SchoolClass, ClassSubjectRequirement.class_id == SchoolClass.id)
        .where(ClassSubjectRequirement.id == requirement_id, SchoolClass.tenant_id == tenant.id)
    ).first()
    if req is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Requirement {requirement_id} not found")
    return req


def _validate_pinned_teacher(db: Session, teacher_id: int | None, subject_id: int, tenant: Tenant) -> None:
    """A pinned teacher must actually be qualified for the subject - the
    solver would otherwise be handed an unsatisfiable hard constraint."""
    if teacher_id is None:
        return
    teacher = db.get(Teacher, teacher_id)
    if teacher is None or teacher.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Teacher {teacher_id} not found")
    qualified = db.scalar(
        select(TeacherSubject).where(
            TeacherSubject.teacher_id == teacher_id, TeacherSubject.subject_id == subject_id
        )
    )
    if qualified is None:
        subject = db.get(Subject, subject_id)
        subject_name = subject.name if subject else f"subject {subject_id}"
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"{teacher.name} isn't qualified to teach {subject_name} - add that subject under "
            f"Teachers -> Subjects (or the Assignments matrix) before pinning them here.",
        )


@router.get("", response_model=list[RequirementOut])
def list_requirements(
    class_id: int | None = None, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> list[ClassSubjectRequirement]:
    stmt = (
        select(ClassSubjectRequirement)
        .join(SchoolClass, ClassSubjectRequirement.class_id == SchoolClass.id)
        .where(SchoolClass.tenant_id == tenant.id)
        .options(joinedload(ClassSubjectRequirement.teacher))
    )
    if class_id is not None:
        stmt = stmt.where(ClassSubjectRequirement.class_id == class_id)
    return list(db.scalars(stmt).all())


@router.get("/{requirement_id}", response_model=RequirementOut)
def get_requirement(requirement_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> ClassSubjectRequirement:
    return _get_requirement_or_404(db, requirement_id, tenant)


@router.post("", response_model=RequirementOut, status_code=status.HTTP_201_CREATED)
def create_requirement(payload: RequirementCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> ClassSubjectRequirement:
    school_class = db.get(SchoolClass, payload.class_id)
    if school_class is None or school_class.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Class {payload.class_id} not found")
    subject = db.get(Subject, payload.subject_id)
    if subject is None or subject.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Subject {payload.subject_id} not found")
    _validate_pinned_teacher(db, payload.teacher_id, payload.subject_id, tenant)

    req = ClassSubjectRequirement(**payload.model_dump())
    db.add(req)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="A requirement for this class+subject already exists"
        ) from exc
    db.refresh(req)
    return req


@router.put("/{requirement_id}", response_model=RequirementOut)
def update_requirement(
    requirement_id: int, payload: RequirementUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> ClassSubjectRequirement:
    req = _get_requirement_or_404(db, requirement_id, tenant)
    data = payload.model_dump(exclude_unset=True)
    if "teacher_id" in data:
        _validate_pinned_teacher(db, data["teacher_id"], req.subject_id, tenant)
    for field, value in data.items():
        setattr(req, field, value)
    db.commit()
    db.refresh(req)
    return req


@router.delete("/{requirement_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_requirement(requirement_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    req = _get_requirement_or_404(db, requirement_id, tenant)
    db.delete(req)
    db.commit()
