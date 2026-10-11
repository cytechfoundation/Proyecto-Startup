"""Registro de los PDFs del Calendario Tributario subidos por los administradores.

Cada fila corresponde a un archivo guardado en disco (`data/tax_calendar/`) y a
los eventos que ese PDF importó. La lista se sirve ordenada por fecha de subida
(más reciente primero), que es lo que muestra el panel admin de `/cuenta`.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class TaxUpload(Base):
    __tablename__ = "tax_uploads"

    id: Mapped[str] = mapped_column(String(16), primary_key=True)  # id del archivo en disco
    filename: Mapped[str] = mapped_column(String(255), nullable=False)  # nombre original visible
    size: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, default="")
    year: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_created: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_duplicated: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    events_total: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    uploaded_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
