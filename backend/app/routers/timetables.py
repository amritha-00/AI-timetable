"""Timetable generation and viewing endpoints."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session, joinedload

from app.auth import get_current_tenant
from app.db.session import get_db
from app.llm.explainer import explain_timetable_message
from app.models.day import Day
from app.models.period import Period
from app.models.room import Room, RoomType
from app.models.tenant import Tenant
from app.models.timetable import Timetable, TimetableEntry
from app.schemas.timetable import MoveEntryRequest, TimetableEntryOut, TimetableGenerateRequest, TimetableOut
from app.solver.cp_solver import generate_timetable

router = APIRouter(prefix="/api/timetables", tags=["timetables"])


@router.post("/generate", response_model=TimetableOut, status_code=status.HTTP_201_CREATED)
def generate(
    payload: TimetableGenerateRequest, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)
) -> Timetable:
    """
    Run the CP-SAT solver and persist the result.

    Always returns 201 with a `Timetable` row - check `status` in the
    response: `completed` means entries were generated (fetch them via
    `GET /api/timetables/{id}/entries`), `failed` means no feasible
    timetable was found, with a human-readable explanation in `message`.
    This endpoint can take up to `SOLVER_MAX_SECONDS` (see .env) to respond.

    Gated by the tenants free trial: the first FREE_TRIAL_GENERATIONS calls
    (counted whether the result succeeds or fails) are free; after that, an
    unsubscribed tenant gets 402 instead of the solver running at all.
    """
    if not tenant.can_generate:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail="You have used all 3 free timetable generations. Upgrade to keep generating timetables.",
        )
    tenant.trial_generations_used += 1
    db.commit()

    result = generate_timetable(
        db,
        tenant_id=tenant.id,
        name=payload.name,
        time_limit_seconds=payload.time_limit_seconds,
        include_soft=payload.include_soft,
    )
    return result.timetable


@router.get("", response_model=list[TimetableOut])
def list_timetables(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Timetable]:
    return list(
        db.scalars(
            select(Timetable).where(Timetable.tenant_id == tenant.id).order_by(Timetable.created_at.desc())
        ).all()
    )


@router.get("/{timetable_id}", response_model=TimetableOut)
def get_timetable(timetable_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Timetable:
    timetable = db.get(Timetable, timetable_id)
    if timetable is None or timetable.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Timetable {timetable_id} not found")
    return timetable


@router.get("/{timetable_id}/entries", response_model=list[TimetableEntryOut])
def get_timetable_entries(
    timetable_id: int,
    class_id: int | None = None,
    teacher_id: int | None = None,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
) -> list[TimetableEntryOut]:
    """
    Full entry list for a timetable, denormalized for direct rendering.
    Filter with `class_id` for the class view or `teacher_id` for the
    teacher view (Phase 4 frontend).
    """
    timetable = db.get(Timetable, timetable_id)
    if timetable is None or timetable.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Timetable {timetable_id} not found")

    stmt = (
        select(TimetableEntry)
        .where(TimetableEntry.timetable_id == timetable_id)
        .options(
            joinedload(TimetableEntry.school_class),
            joinedload(TimetableEntry.day),
            joinedload(TimetableEntry.period),
            joinedload(TimetableEntry.subject),
            joinedload(TimetableEntry.teacher),
            joinedload(TimetableEntry.room),
        )
    )
    if class_id is not None:
        stmt = stmt.where(TimetableEntry.class_id == class_id)
    if teacher_id is not None:
        stmt = stmt.where(TimetableEntry.teacher_id == teacher_id)

    entries = db.scalars(stmt).all()
    return [
        TimetableEntryOut(
            id=e.id,
            class_id=e.class_id,
            class_name=e.school_class.display_name,
            day_id=e.day_id,
            day_name=e.day.name,
            period_id=e.period_id,
            period_number=e.period.period_number,
            start_time=e.period.start_time,
            end_time=e.period.end_time,
            subject_id=e.subject_id,
            subject_name=e.subject.name,
            subject_is_lab=e.subject.is_lab,
            teacher_id=e.teacher_id,
            teacher_name=e.teacher.name,
            room_id=e.room_id,
            room_name=e.room.name,
        )
        for e in entries
    ]


@router.get("/{timetable_id}/explain")
def explain_timetable(timetable_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> dict:
    """
    Plain-English explanation of this timetable's result, via the LLM layer
    (same provider configured for constraint parsing). Falls back to the raw
    technical message if the LLM call fails, so this never 500s just because
    an API key is missing.
    """
    timetable = db.get(Timetable, timetable_id)
    if timetable is None or timetable.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Timetable {timetable_id} not found")
    explanation = explain_timetable_message(timetable.message or "")
    return {"timetable_id": timetable_id, "explanation": explanation}


@router.put("/{timetable_id}/entries/{entry_id}/move", response_model=TimetableEntryOut)
def move_entry(
    timetable_id: int,
    entry_id: int,
    payload: MoveEntryRequest,
    db: Session = Depends(get_db),
    tenant: Tenant = Depends(get_current_tenant),
) -> TimetableEntryOut:
    """
    Manual drag-and-drop edit: move one entry to a different (day, period).
    Re-validates the hard constraints that actually apply to a single-entry
    move - the class, the teacher, and the room must all still be free at
    the new slot (the room is auto-reassigned within the same room-type pool
    if the original room is taken; the move is rejected only if none are
    free). Rejected moves return 409 with a human-readable reason instead of
    silently creating a clash.
    """
    timetable = db.get(Timetable, timetable_id)
    if timetable is None or timetable.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Timetable {timetable_id} not found")

    entry = db.get(TimetableEntry, entry_id)
    if entry is None or entry.timetable_id != timetable_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Entry {entry_id} not found")

    period = db.get(Period, payload.period_id)
    if period is None or period.is_break:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target period is invalid or a break")
    if db.get(Day, payload.day_id) is None:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Target day is invalid")

    others_at_slot = list(
        db.scalars(
            select(TimetableEntry).where(
                TimetableEntry.timetable_id == timetable_id,
                TimetableEntry.day_id == payload.day_id,
                TimetableEntry.period_id == payload.period_id,
                TimetableEntry.id != entry_id,
            )
        ).all()
    )

    if any(o.class_id == entry.class_id for o in others_at_slot):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This class already has a subject scheduled at that day/period.",
        )
    if any(o.teacher_id == entry.teacher_id for o in others_at_slot):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This teacher is already teaching another class at that day/period.",
        )

    used_room_ids = {o.room_id for o in others_at_slot}
    if entry.room_id in used_room_ids:
        subject = entry.subject
        room_type = RoomType.LAB if subject.is_lab else RoomType.CLASSROOM
        candidate_rooms = list(db.scalars(select(Room).where(Room.room_type == room_type)).all())
        free_room = next((r for r in candidate_rooms if r.id not in used_room_ids), None)
        if free_room is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"No free {room_type.value} room is available at that day/period.",
            )
        entry.room_id = free_room.id

    entry.day_id = payload.day_id
    entry.period_id = payload.period_id
    db.commit()
    db.refresh(entry)

    return TimetableEntryOut(
        id=entry.id,
        class_id=entry.class_id,
        class_name=entry.school_class.display_name,
        day_id=entry.day_id,
        day_name=entry.day.name,
        period_id=entry.period_id,
        period_number=entry.period.period_number,
        start_time=entry.period.start_time,
        end_time=entry.period.end_time,
        subject_id=entry.subject_id,
        subject_name=entry.subject.name,
        subject_is_lab=entry.subject.is_lab,
        teacher_id=entry.teacher_id,
        teacher_name=entry.teacher.name,
        room_id=entry.room_id,
        room_name=entry.room.name,
    )


@router.delete("/{timetable_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_timetable(timetable_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    timetable = db.get(Timetable, timetable_id)
    if timetable is None or timetable.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Timetable {timetable_id} not found")
    db.delete(timetable)
    db.commit()
