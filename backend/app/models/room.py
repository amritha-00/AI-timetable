"""Room model."""
from __future__ import annotations

import enum

from sqlalchemy import Enum, ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class RoomType(str, enum.Enum):
    CLASSROOM = "classroom"
    LAB = "lab"
    AUDITORIUM = "auditorium"
    SPORTS = "sports"


class Room(Base):
    __tablename__ = "rooms"
    __table_args__ = (UniqueConstraint("tenant_id", "name", name="uq_tenant_room_name"),)

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(50), nullable=False)
    room_type: Mapped[RoomType] = mapped_column(
        Enum(RoomType, native_enum=False, length=20, values_callable=lambda enum_cls: [e.value for e in enum_cls]),
        default=RoomType.CLASSROOM,
        nullable=False,
    )
    capacity: Mapped[int] = mapped_column(Integer, default=40, nullable=False)

    def __repr__(self) -> str:
        return f"<Room id={self.id} name={self.name!r} type={self.room_type}>"
