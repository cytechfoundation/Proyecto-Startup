"""Modelo para el Calendario Tributario (almacenado por año)."""
from datetime import date, datetime, timezone
from sqlalchemy import DateTime, String, Date, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaxCalendar(Base):
    __tablename__ = "tax_calendar"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    # Anio al que pertenece el evento. Permite consultar/exportar por anio
    # (p. ej. /tax-calendar/events?year=2026) sin recorrer toda la tabla.
    year: Mapped[int] = mapped_column(Integer, nullable=False, index=True, default=2026)
    obligation: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str] = mapped_column(Text, nullable=True)
    category: Mapped[str] = mapped_column(String(100), default="General")
    # Archivo del que provino el evento (auditoria del import admin).
    source: Mapped[str] = mapped_column(String(255), nullable=True, default="import")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
