"""
Endpoints for the LLM constraint layer: parse plain English into a
structured (but not-yet-saved) preview, then save it once the admin
confirms - or edits/rejects it - on the frontend.
"""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.db.session import get_db
from app.llm.describe import describe_resolved_constraint
from app.llm.parser import parse_constraint_text
from app.models.constraint import Constraint, ConstraintSeverity, ConstraintType
from app.models.tenant import Tenant
from app.schemas.constraint import ConfirmRequest, ConstraintOut, ConstraintUpdate, ParseRequest, ParseResponse

router = APIRouter(prefix="/api/constraints", tags=["constraints"])


@router.post("/parse", response_model=ParseResponse)
def parse_constraint(
    payload: ParseRequest, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> ParseResponse:
    """
    Parse one English sentence. Does NOT save anything - the frontend shows
    the result as a confirm/edit/reject card and calls `POST /api/constraints`
    (with the same or an edited payload) to actually persist it.
    """
    outcome = parse_constraint_text(db, payload.text, history=payload.history, tenant_id=tenant.id)

    if outcome.status == "resolved":
        r = outcome.resolved
        return ParseResponse(
            status="resolved",
            raw_text=outcome.raw_text,
            constraint_type=r.constraint_type,
            severity=r.severity,
            weight=r.weight,
            payload=r.payload,
            llm_explanation=r.explanation,
            human_description=describe_resolved_constraint(db, r.constraint_type, r.payload),
        )

    if outcome.status == "clarification_needed":
        c = outcome.clarification
        return ParseResponse(
            status="clarification_needed",
            raw_text=outcome.raw_text,
            clarification_question=c.clarification_question,
            candidates=c.candidates,
        )

    # unparseable | llm_error
    return ParseResponse(status=outcome.status, raw_text=outcome.raw_text, error_message=outcome.error_message)


@router.post("", response_model=ConstraintOut, status_code=status.HTTP_201_CREATED)
def save_constraint(
    payload: ConfirmRequest, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> Constraint:
    """Persist a constraint the admin has confirmed (or manually edited) from
    a `/parse` response. Re-validates the type/severity here too, since the
    frontend could in principle send anything."""
    try:
        constraint_type = ConstraintType(payload.constraint_type)
    except ValueError as exc:
        valid = ", ".join(t.value for t in ConstraintType)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown constraint_type '{payload.constraint_type}'. Valid types: {valid}",
        ) from exc

    constraint = Constraint(
        tenant_id=tenant.id,
        constraint_type=constraint_type,
        raw_text=payload.raw_text,
        payload=payload.payload,
        severity=ConstraintSeverity(payload.severity),
        weight=payload.weight,
        is_active=True,
    )
    db.add(constraint)
    db.commit()
    db.refresh(constraint)

    out = ConstraintOut.model_validate(constraint)
    out.constraint_type = constraint.constraint_type.value
    out.severity = constraint.severity.value
    out.description = describe_resolved_constraint(db, constraint.constraint_type.value, constraint.payload)
    return out


@router.get("", response_model=list[ConstraintOut])
def list_constraints(
    active_only: bool = False, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> list[ConstraintOut]:
    stmt = select(Constraint).where(Constraint.tenant_id == tenant.id).order_by(Constraint.created_at.desc())
    if active_only:
        stmt = stmt.where(Constraint.is_active.is_(True))
    constraints = list(db.scalars(stmt).all())

    results = []
    for c in constraints:
        out = ConstraintOut.model_validate(c)
        out.constraint_type = c.constraint_type.value
        out.severity = c.severity.value
        out.description = describe_resolved_constraint(db, c.constraint_type.value, c.payload)
        results.append(out)
    return results


def _get_constraint_or_404(db: Session, constraint_id: int, tenant: Tenant) -> Constraint:
    constraint = db.get(Constraint, constraint_id)
    if constraint is None or constraint.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Constraint {constraint_id} not found")
    return constraint


@router.put("/{constraint_id}", response_model=ConstraintOut)
def update_constraint(
    constraint_id: int, payload: ConstraintUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> ConstraintOut:
    constraint = _get_constraint_or_404(db, constraint_id, tenant)
    if payload.severity is not None:
        constraint.severity = ConstraintSeverity(payload.severity)
    if payload.weight is not None:
        constraint.weight = payload.weight
    if payload.is_active is not None:
        constraint.is_active = payload.is_active
    db.commit()
    db.refresh(constraint)

    out = ConstraintOut.model_validate(constraint)
    out.constraint_type = constraint.constraint_type.value
    out.severity = constraint.severity.value
    out.description = describe_resolved_constraint(db, constraint.constraint_type.value, constraint.payload)
    return out


@router.delete("/{constraint_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_constraint(constraint_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    constraint = _get_constraint_or_404(db, constraint_id, tenant)
    db.delete(constraint)
    db.commit()
