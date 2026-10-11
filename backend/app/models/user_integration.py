"""Integraciones externas vinculadas por usuario (ej. PayPal)."""
from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class UserIntegration(Base):
    __tablename__ = "user_integrations"
    __table_args__ = (UniqueConstraint("user_id", "provider", name="uq_user_provider"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    provider: Mapped[str] = mapped_column(String(40), nullable=False)  # paypal | pos | dian
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="connected")
    account: Mapped[str | None] = mapped_column(String(320), nullable=True, default=None)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)  # True solo si PayPal lo confirma
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
