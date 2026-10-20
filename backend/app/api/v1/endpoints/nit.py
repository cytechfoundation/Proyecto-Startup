"""Consulta y persistencia de NIT contra los datos abiertos del RUES.

`GET /nit/{nit}` consulta el dataset de Confecámaras publicado en datos.gov.co
y **guarda el resultado en la tabla propia `rues_records`** (clave = NIT), de
modo que cada NIT es su propia fila y nunca se pisan entre consultas. La
cuenta solo conserva el NIT que la identifica; el registro oficial vive aquí.
"""
import math
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.rues import RuesRecord
from app.models.user import User
from app.services import nit_service, rues_service

router = APIRouter(prefix="/nit", tags=["nit"])


class RuesOut(BaseModel):
    """Contrato de salida del registro RUES persistido."""

    nit: str
    digito_verificacion: str | None = None
    razon_social: str | None = None
    representante_legal: str | None = None
    identificacion_representante: str | None = None
    camara_comercio: str | None = None
    matricula: str | None = None
    estado_matricula: str | None = None
    organizacion_juridica: str | None = None
    tipo_sociedad: str | None = None
    categoria_matricula: str | None = None
    actividad_economica: str | None = None
    fecha_matricula: str | None = None
    ultimo_ano_renovado: str | None = None
    fecha_actualizacion: str | None = None
    fuente: str | None = None
    consulted_at: datetime | None = None

    model_config = {"from_attributes": True}


class RuesPage(BaseModel):
    """Respuesta paginada del historial de NITs consultados."""

    items: list[RuesOut]
    total: int
    page: int
    page_size: int
    pages: int


@router.get("/records", response_model=RuesPage)
def list_records(
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    q: str | None = Query(None, max_length=100),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Historial paginado de NITs consultados (registros RUES cacheados).

    Se pagina en el servidor para que, con muchos registros, solo viaje una
    página a la vez. El parámetro `q` filtra por NIT, razón social, cámara o
    matrícula antes de paginar, de modo que el buscador abarca todo el conjunto.
    """
    stmt = select(RuesRecord)
    count_stmt = select(func.count()).select_from(RuesRecord)

    term = (q or "").strip()
    if term:
        like = f"%{term}%"
        cond = or_(
            RuesRecord.nit.like(like),
            RuesRecord.razon_social.like(like),
            RuesRecord.camara_comercio.like(like),
            RuesRecord.matricula.like(like),
        )
        stmt = stmt.where(cond)
        count_stmt = count_stmt.where(cond)

    total = int(db.scalar(count_stmt) or 0)
    pages = max(1, math.ceil(total / page_size))
    if page > pages:
        page = pages  # si se borró la última página, retrocede al último hueco válido

    registros = (
        db.scalars(
            stmt.order_by(RuesRecord.consulted_at.desc())
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
        .all()
    )
    return RuesPage(
        items=[RuesOut.model_validate(r) for r in registros],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.delete("/records/{nit}", status_code=204)
def delete_record(
    nit: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Elimina del cache el registro RUES de un NIT concreto."""
    if not rues_service.delete(db, nit):
        raise HTTPException(404, f"No hay registro cacheado del NIT {nit}.")
    return None


@router.get("/{nit:path}", response_model=RuesOut)
def lookup_nit(
    nit: str,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Consulta el NIT en el RUES, lo persiste en `rues_records` y lo devuelve.

    El registro se guarda/actualiza con el NIT como clave, por lo que consultar
    un NIT nunca sobrescribe el registro de otro.
    """
    try:
        data = nit_service.lookup(nit)
    except nit_service.NitError as exc:
        # 502: la fuente externa falló (no confundir con «NIT inexistente»).
        raise HTTPException(502, f"Fuente de datos no disponible: {exc}") from exc
    if not data:
        raise HTTPException(404, f"No se encontró registro para el NIT {nit}.")

    registro = rues_service.upsert(db, nit=data["nit"], data=data, consulted_by=current.id)
    return RuesOut.model_validate(registro)
