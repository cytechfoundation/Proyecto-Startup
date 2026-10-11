"""Contadores de impacto de la fundación (becas, equipos, talleres).

`GET` es público: la página de donación los muestra en vivo. La escritura
(`PUT` y `POST .../adjust`) es exclusiva de administradores, igual que el
resto de datos que ve el público.
"""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.user import User
from app.services import impact_service

router = APIRouter(prefix="/impact", tags=["impact"])


class ValueIn(BaseModel):
    value: int = Field(ge=impact_service.MIN_VALUE, le=impact_service.MAX_VALUE,
                       description="Valor final del contador")


class AdjustIn(BaseModel):
    delta: int = Field(default=1, ge=-1000, le=1000,
                       description="Unidades a sumar (positivo) o restar (negativo)")


def _row_or_404(db: Session, key: str):
    try:
        return impact_service.get_counter(db, key)
    except impact_service.UnknownCounter:
        raise HTTPException(404, f"Contador '{key}' inexistente. Catálogo: "
                                 f"{', '.join(impact_service.DEFAULTS)}.")


@router.get("/counters")
def list_counters(db: Session = Depends(get_db)):
    """Cifras de impacto que publica la landing (becas, equipos, talleres)."""
    rows = impact_service.get_counters(db)
    return {"count": len(rows), "counters": [impact_service.to_dict(r) for r in rows]}


@router.get("/counters/{key}")
def get_counter(key: str, db: Session = Depends(get_db)):
    return impact_service.to_dict(_row_or_404(db, key))


@router.put("/counters/{key}")
def set_counter(key: str, body: ValueIn, db: Session = Depends(get_db),
                _: User = Depends(require_admin)):
    """Fija el valor del contador (panel admin de /cuenta)."""
    row = _row_or_404(db, key)
    row = impact_service.set_value(db, row.key, body.value)
    return impact_service.to_dict(row)


@router.post("/counters/{key}/adjust")
def adjust_counter(key: str, body: AdjustIn, db: Session = Depends(get_db),
                   _: User = Depends(require_admin)):
    """Suma/resta unidades: el botón «+1 beca» del panel admin usa delta=1."""
    _row_or_404(db, key)
    row = impact_service.adjust(db, key, body.delta)
    return impact_service.to_dict(row)
