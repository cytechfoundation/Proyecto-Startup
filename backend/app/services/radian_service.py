"""Servicio RADIAN: máquina de estados de la FEV como Título Valor.

La DIAN exige que la hoja de vida de la factura electrónica de venta siga un
orden: emisión → validación → aceptación (expresa o tácita) o rechazo →
endoso (el título valor circula) → pago; la anulación cierra el ciclo desde
cualquier estado no terminal. Este servicio centraliza esa máquina de estados
para que la registren igual los endpoints y los webhooks DIAN.

La validación real con la DIAN exige proveedor tecnológico autorizado: aquí el
CUFE se genera determinista (stub) siguiendo el mismo patrón de `dian_service`.
"""
import json

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.radian import RadianEvent, RadianRecord
from app.services import dian_service

# Evento → etiqueta legible (chips y timeline del dashboard).
EVENT_LABELS: dict[str, str] = {
    "emision": "Emisión del título",
    "validacion": "Validación DIAN",
    "aceptacion_expresa": "Aceptación expresa",
    "aceptacion_tacita": "Aceptación tácita",
    "rechazo": "Rechazo del adquirente",
    "endoso": "Endoso (circulación)",
    "pago": "Pago",
    "anulacion": "Anulación",
}

# Estado → etiqueta legible.
STATE_LABELS: dict[str, str] = {
    "emitida": "Emitida",
    "validada": "Validada DIAN",
    "aceptada": "Aceptada",
    "endosada": "Endosada",
    "rechazada": "Rechazada",
    "pagada": "Pagada",
    "anulada": "Anulada",
}

# Máquina de estados: estado_actual → {evento → estado_resultante}.
# Un estado sin transiciones (pagada/anulada/rechazada) es terminal.
TRANSITIONS: dict[str, dict[str, str]] = {
    "emitida": {"validacion": "validada", "anulacion": "anulada"},
    "validada": {
        "aceptacion_expresa": "aceptada",
        "aceptacion_tacita": "aceptada",
        "rechazo": "rechazada",
        "anulacion": "anulada",
    },
    "aceptada": {"endoso": "endosada", "pago": "pagada", "anulacion": "anulada"},
    "endosada": {"pago": "pagada", "anulacion": "anulada"},
    "rechazada": {},
    "pagada": {},
    "anulada": {},
}

EVENT_TYPES = tuple(sorted({e for evs in TRANSITIONS.values() for e in evs} | {"emision"}))


def allowed_events(estado: str) -> list[str]:
    """Eventos posibles desde un estado (para poblar el formulario del dashboard)."""
    return sorted(TRANSITIONS.get(estado, {}))


def make_cufe(numero: str, nit_emisor: str, nit_adquirente: str, valor_total: int) -> str:
    """CUFE determinista (stub). En producción lo emite la DIAN vía proveedor autorizado."""
    return dian_service.emit_document("FV", f"{numero}|{nit_emisor}|{nit_adquirente}", valor_total, nit_emisor)["cufe"]


def register_record(
    db: Session,
    *,
    user_id: str,
    numero: str,
    nit_emisor: str,
    nit_adquirente: str,
    valor_total: int,
    moneda: str = "COP",
    payload: dict | None = None,
) -> RadianRecord:
    """Registra la FEV como Título Valor y escribe el evento de emisión."""
    record = RadianRecord(
        user_id=user_id,
        numero=numero,
        nit_emisor=nit_emisor,
        nit_adquirente=nit_adquirente,
        valor_total=valor_total,
        moneda=moneda.upper(),
        estado="emitida",
        cufe=make_cufe(numero, nit_emisor, nit_adquirente, valor_total),
        payload=json.dumps(payload or {}, ensure_ascii=False)[:4000] if payload else None,
    )
    db.add(record)
    db.flush()  # obtiene el id antes del evento
    db.add(RadianEvent(
        record_id=record.id, tipo="emision", actor="sistema",
        detalle=f"FEV {numero} registrada como Título Valor ante RADIAN.",
        estado_resultante="emitida",
    ))
    db.commit()
    db.refresh(record)
    return record


def apply_event(
    db: Session,
    record: RadianRecord,
    tipo: str,
    *,
    actor: str,
    detalle: str | None = None,
    monto_cents: int | None = None,
    endosatario_nit: str | None = None,
) -> tuple[RadianEvent, str] | None:
    """Aplica un evento a la hoja de vida. Retorna None si la transición no es válida."""
    nuevo = TRANSITIONS.get(record.estado, {}).get(tipo)
    if nuevo is None:
        return None
    if tipo == "endoso" and not endosatario_nit:
        raise ValueError("El endoso exige el NIT del endosatario.")
    record.estado = nuevo
    if tipo == "endoso":
        record.endosatario_nit = endosatario_nit
    ev = RadianEvent(
        record_id=record.id, tipo=tipo, actor=actor, detalle=detalle,
        monto_cents=monto_cents, estado_resultante=nuevo,
    )
    db.add(ev)
    db.commit()
    db.refresh(ev)
    return ev, nuevo


def find_by_cufe(db: Session, cufe: str) -> RadianRecord | None:
    return db.scalar(select(RadianRecord).where(RadianRecord.cufe == cufe))
