"""Contadores públicos de impacto de la fundación (becas, equipos, talleres).

La página de donación muestra estas cifras en vivo; el panel de `/cuenta`
(rol admin) permite actualizarlas o moverlas de uno en uno.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class ImpactCounter(Base):
    __tablename__ = "impact_counters"

    key: Mapped[str] = mapped_column(String(40), primary_key=True)  # becas | equipos | talleres
    value: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    label: Mapped[str] = mapped_column(String(80), nullable=False, default="")
    unit: Mapped[str] = mapped_column(String(40), nullable=False, default="")
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )
