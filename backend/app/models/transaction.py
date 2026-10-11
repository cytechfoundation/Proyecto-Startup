"""Libro transaccional: facturas, pagos, reembolsos y eventos webhook."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class Transaction(Base):
    __tablename__ = "transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str | None] = mapped_column(String(36), nullable=True, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False, index=True)  # paypal | dian | pos | demo
    kind: Mapped[str] = mapped_column(String(20), nullable=False, index=True)  # invoice | payment | refund | webhook
    amount: Mapped[int] = mapped_column(Integer, nullable=False, default=0)  # centavos COP
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="COP")
    status: Mapped[str] = mapped_column(String(30), nullable=False, default="pending", index=True)
    external_id: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    event_id: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None, index=True)  # id del evento webhook (dedupe)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)  # JSON del evento
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
