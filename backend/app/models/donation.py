"""Promesas de donación a Cytech Foundation (se confirman con PayPal o transferencia)."""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Donation(Base):
    __tablename__ = "donations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    email: Mapped[str] = mapped_column(String(320), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)  # COP
    cause: Mapped[str] = mapped_column(String(40), nullable=False)  # becas | equipos | talleres
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
