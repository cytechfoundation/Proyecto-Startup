"""RADIAN: hoja de vida de la Factura Electrónica de Venta (FEV) como Título Valor.

RADIAN es el registro de la DIAN para los títulos valor derivados de la
facturación electrónica: cada FEV se registra con su CUFE y acumula eventos
(emisión, validación, aceptación, endoso, pago, anulación) que componen su
trazabilidad. Este módulo replica esa hoja de vida en nuestra BD.
"""
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


def _now() -> datetime:
    return datetime.now(timezone.utc)


class RadianRecord(Base):
    """FEV registrada como Título Valor (una fila por factura)."""
    __tablename__ = "radian_records"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)  # emisor responsable
    numero: Mapped[str] = mapped_column(String(40), nullable=False)  # número de la factura de venta
    nit_emisor: Mapped[str] = mapped_column(String(20), nullable=False)
    nit_adquirente: Mapped[str] = mapped_column(String(20), nullable=False)
    valor_total: Mapped[int] = mapped_column(Integer, nullable=False)  # centavos
    moneda: Mapped[str] = mapped_column(String(10), nullable=False, default="COP")
    estado: Mapped[str] = mapped_column(String(20), nullable=False, default="emitida", index=True)
    endosatario_nit: Mapped[str | None] = mapped_column(String(20), nullable=True, default=None)
    cufe: Mapped[str] = mapped_column(String(128), nullable=False, unique=True, index=True)
    payload: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)  # datos extra (JSON)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=_now, onupdate=_now
    )


class RadianEvent(Base):
    """Evento de la hoja de vida de una FEV (una fila por evento)."""
    __tablename__ = "radian_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    record_id: Mapped[str] = mapped_column(String(36), nullable=False, index=True)
    tipo: Mapped[str] = mapped_column(String(30), nullable=False)  # emision | validacion | ... | anulacion
    actor: Mapped[str] = mapped_column(String(120), nullable=False)  # email del usuario o "dian"
    detalle: Mapped[str | None] = mapped_column(Text, nullable=True, default=None)
    monto_cents: Mapped[int | None] = mapped_column(Integer, nullable=True, default=None)  # pago/endoso
    estado_resultante: Mapped[str] = mapped_column(String(20), nullable=False)  # estado tras el evento
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=_now)
