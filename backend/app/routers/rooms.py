"""CRUD endpoints for Rooms."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.auth import get_current_tenant
from app.db.session import get_db
from app.models.room import Room
from app.models.tenant import Tenant
from app.schemas.room import RoomCreate, RoomOut, RoomUpdate

router = APIRouter(prefix="/api/rooms", tags=["rooms"])


def _get_room_or_404(db: Session, room_id: int, tenant: Tenant) -> Room:
    room = db.get(Room, room_id)
    if room is None or room.tenant_id != tenant.id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Room {room_id} not found")
    return room


@router.get("", response_model=list[RoomOut])
def list_rooms(db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> list[Room]:
    return list(db.scalars(select(Room).where(Room.tenant_id == tenant.id).order_by(Room.name)).all())


@router.get("/{room_id}", response_model=RoomOut)
def get_room(room_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Room:
    return _get_room_or_404(db, room_id, tenant)


@router.post("", response_model=RoomOut, status_code=status.HTTP_201_CREATED)
def create_room(payload: RoomCreate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Room:
    room = Room(**payload.model_dump(), tenant_id=tenant.id)
    db.add(room)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room name already exists") from exc
    db.refresh(room)
    return room


@router.put("/{room_id}", response_model=RoomOut)
def update_room(room_id: int, payload: RoomUpdate, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> Room:
    room = _get_room_or_404(db, room_id, tenant)
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(room, field, value)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Room name already exists") from exc
    db.refresh(room)
    return room


@router.delete("/{room_id}", status_code=status.HTTP_204_NO_CONTENT, response_model=None)
def delete_room(room_id: int, db: Session = Depends(get_db), tenant: Tenant = Depends(get_current_tenant)) -> None:
    room = _get_room_or_404(db, room_id, tenant)
    db.delete(room)
    db.commit()
