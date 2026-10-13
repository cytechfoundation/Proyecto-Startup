"""RADIAN: registro, consulta y trazabilidad de la FEV como Título Valor.

Cada factura electrónica de venta registrada acumula una hoja de vida de
eventos (emisión → validación → aceptación/rechazo → endoso → pago/anulación)
que la DIAN exige como prueba de circulación del título valor.
"""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.rbac import RequirePermission
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.radian import RadianEvent, RadianRecord
from app.models.user import User
from app.schemas.radian import (
    PaginatedRadianOut,
    RadianEventIn,
    RadianEventOut,
    RadianRecordDetailOut,
    RadianRecordIn,
    RadianRecordOut,
)
from app.services import radian_service

router = APIRouter(prefix="/radian", tags=["radian"])


def _get_record(db: Session, record_id: str, current: User) -> RadianRecord:
    """Detalle con control de acceso: el cliente solo ve las suyas."""
    record = db.get(RadianRecord, record_id)
    if record is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Factura no encontrada en RADIAN")
    if current.role != "admin" and record.user_id != str(current.id):
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta factura pertenece a otro usuario")
    return record


@router.get("/records", response_model=PaginatedRadianOut)
def list_records(
    estado: str | None = Query(default=None, description="Filtrar por estado de la hoja de vida"),
    nit: str | None = Query(default=None, description="Buscar por NIT de emisor o adquirente"),
    q: str | None = Query(default=None, description="Buscar por CUFE o número de factura"),
    all_: bool = Query(default=False, alias="all", description="Solo admin: ver todas"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current: User = Depends(RequirePermission("dian", "view")),
    db: Session = Depends(get_db),
):
    stmt = select(RadianRecord).order_by(RadianRecord.created_at.desc())
    if not (all_ and current.role == "admin"):
        stmt = stmt.where(RadianRecord.user_id == str(current.id))
    if estado:
        stmt = stmt.where(RadianRecord.estado == estado)
    if nit:
        stmt = stmt.where(or_(RadianRecord.nit_emisor == nit, RadianRecord.nit_adquirente == nit))
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(RadianRecord.cufe.like(like), RadianRecord.numero.like(like)))
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    pages = max((total + page_size - 1) // page_size, 1)
    page = min(page, pages)
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedRadianOut(
        items=[RadianRecordOut.model_validate(r) for r in items],
        total=total, page=page, page_size=page_size, pages=pages,
    )


@router.post("/records", response_model=RadianRecordOut, status_code=201)
def create_record(
    body: RadianRecordIn,
    current: User = Depends(RequirePermission("dian", "create")),
    db: Session = Depends(get_db),
):
    """Registra una FEV como Título Valor y abre su hoja de vida (evento de emisión)."""
    if body.nit_emisor.strip() == body.nit_adquirente.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El NIT del adquirente debe distinguirse del del emisor")
    record = radian_service.register_record(
        db,
        user_id=str(current.id),
        numero=body.numero.strip(),
        nit_emisor=body.nit_emisor.strip(),
        nit_adquirente=body.nit_adquirente.strip(),
        valor_total=body.valor_total,
        moneda=body.moneda,
        payload=body.payload,
    )
    return RadianRecordOut.model_validate(record)


@router.get("/records/{record_id}", response_model=RadianRecordDetailOut)
def get_record(
    record_id: str,
    current: User = Depends(RequirePermission("dian", "view")),
    db: Session = Depends(get_db),
):
    """Detalle de la FEV con su hoja de vida completa."""
    record = _get_record(db, record_id, current)
    eventos = db.scalars(
        select(RadianEvent).where(RadianEvent.record_id == record.id).order_by(RadianEvent.created_at.asc(), RadianEvent.id.asc())
    ).all()
    detail = RadianRecordDetailOut.model_validate(record)
    detail.eventos = [RadianEventOut.model_validate(e) for e in eventos]
    return detail


@router.get("/records/{record_id}/events", response_model=list[RadianEventOut])
def list_events(
    record_id: str,
    current: User = Depends(RequirePermission("dian", "view")),
    db: Session = Depends(get_db),
):
    """Hoja de vida: eventos ordenados cronológicamente."""
    record = _get_record(db, record_id, current)
    events = db.scalars(
        select(RadianEvent).where(RadianEvent.record_id == record.id).order_by(RadianEvent.created_at.asc(), RadianEvent.id.asc())
    ).all()
    return [RadianEventOut.model_validate(e) for e in events]


@router.post("/records/{record_id}/events", response_model=RadianEventOut, status_code=201)
def add_event(
    record_id: str,
    body: RadianEventIn,
    current: User = Depends(RequirePermission("dian", "create")),
    db: Session = Depends(get_db),
):
    """Registra un evento en la hoja de vida validando la máquina de estados.

    Una transición inválida responde 409 con los eventos permitidos desde el
    estado actual, para que el dashboard no proponga saltos imposibles.
    """
    record = _get_record(db, record_id, current)
    if body.tipo not in radian_service.EVENT_TYPES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Tipo de evento inválido: {body.tipo}")
    try:
        out = radian_service.apply_event(
            db, record, body.tipo,
            actor=body.actor or current.email,
            detalle=body.detalle,
            monto_cents=body.monto_cents,
            endosatario_nit=body.endosatario_nit,
        )
    except ValueError as e:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, str(e))
    if out is None:
        raise HTTPException(
            status.HTTP_409_CONFLICT,
            f"El evento '{body.tipo}' no es válido desde '{record.estado}'. "
            f"Permitidos: {', '.join(radian_service.allowed_events(record.estado)) or 'ninguno (estado final)'}",
        )
    ev, _ = out
    return RadianEventOut.model_validate(ev)


@router.get("/catalog", response_model=dict)
def catalog(
    _: User = Depends(get_current_user),
):
    """Catálogo de estados, eventos y etiquetas para poblar la UI."""
    return {
        "estados": radian_service.STATE_LABELS,
        "eventos": radian_service.EVENT_LABELS,
        "transiciones": radian_service.TRANSITIONS,
    }
