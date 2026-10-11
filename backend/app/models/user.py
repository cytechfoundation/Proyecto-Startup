"""Tabla User: id, email, name, provider, role, created_at."""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    # String(36) portable: funciona en PostgreSQL y SQLite (tests/demo).
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    email: Mapped[str] = mapped_column(String(320), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, default="")
    provider: Mapped[str] = mapped_column(String(20), nullable=False)  # "google" | "github"
    role: Mapped[str] = mapped_column(String(20), nullable=False, default="client")  # admin | editor | client
    status: Mapped[str] = mapped_column(String(20), nullable=False, default="active")  # active | inactive
    company: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    phone: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    nit: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    person_type: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)  # natural | juridica
    terms_accepted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
