"""Day-of-week model. Kept as a table (not a hardcoded enum) so the school
can configure a 5-day or 6-day week without code changes."""
from __future__ import annotations

from sqlalchemy import ForeignKey, Integer, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.session import Base


class Day(Base):
    __tablename__ = "days"
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="uq_tenant_day_name"),
        UniqueConstraint("tenant_id", "order_index", name="uq_tenant_day_order"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    tenant_id: Mapped[int] = mapped_column(ForeignKey("tenants.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(20), nullable=False)  # "Monday" ...
    # 1 = Monday ... 6 = Saturday. Used for ordering and for "end of week" LLM mapping.
    order_index: Mapped[int] = mapped_column(Integer, nullable=False)

    def __repr__(self) -> str:
        return f"<Day id={self.id} name={self.name!r}>"
