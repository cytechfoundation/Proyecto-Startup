"""Registros del RUES (Confecámaras) cacheados por NIT.

Cada NIT consultado se guarda como su propia fila, con el NIT como clave
primaria, de modo que consultar un NIT nunca pisa a otro. La información vive
aquí (base de datos RUES), no en la fila del usuario: la cuenta solo conserva
el NIT que la identifica.
"""
from datetime import datetime, timezone

from sqlalchemy import DateTime, String
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class RuesRecord(Base):
    __tablename__ = "rues_records"

    # NIT sin dígito de verificación: es la clave natural del registro RUES.
    nit: Mapped[str] = mapped_column(String(20), primary_key=True)
    digito_verificacion: Mapped[str | None] = mapped_column(String(5), nullable=True, default=None)
    razon_social: Mapped[str | None] = mapped_column(String(300), nullable=True, default=None)
    representante_legal: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    identificacion_representante: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    camara_comercio: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    matricula: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    estado_matricula: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    organizacion_juridica: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    tipo_sociedad: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    categoria_matricula: Mapped[str | None] = mapped_column(String(100), nullable=True, default=None)
    actividad_economica: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    fecha_matricula: Mapped[str | None] = mapped_column(String(30), nullable=True, default=None)
    ultimo_ano_renovado: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    fecha_actualizacion: Mapped[str | None] = mapped_column(String(50), nullable=True, default=None)
    fuente: Mapped[str | None] = mapped_column(String(200), nullable=True, default=None)
    # Auditoría de la consulta: quién lo consultó y cuándo se cacheó.
    consulted_by: Mapped[str | None] = mapped_column(String(36), nullable=True, default=None)
    consulted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_utcnow)
