"""Contadores de impacto: lectura pública con siembra y ajuste administrativo.

La primera lectura siembra los valores por defecto (los de la página de
donación), así la landing nunca aparece vacía en una base nueva. Las claves
son cerradas: no se admiten contadores arbitrarios.
"""
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.impact_counter import ImpactCounter

#: key -> valores por defecto (coinciden con la página de donación).
DEFAULTS: dict[str, dict] = {
    "becas": {"label": "Becas de estudio", "unit": "becas", "value": 100},
    "equipos": {"label": "Equipos tecnológicos", "unit": "equipos", "value": 250},
    "talleres": {"label": "Talleres gratuitos", "unit": "talleres", "value": 500},
}

MIN_VALUE = 0
MAX_VALUE = 1_000_000


class UnknownCounter(KeyError):
    """Clave de contador fuera del catálogo permitido."""


def _seed(db: Session) -> None:
    """Inserta los contadores que falten (idempotente)."""
    existentes = {c.key for c in db.scalars(select(ImpactCounter)).all()}
    for key, meta in DEFAULTS.items():
        if key not in existentes:
            db.add(ImpactCounter(key=key, value=meta["value"], label=meta["label"], unit=meta["unit"]))
    db.commit()


def get_counters(db: Session) -> list[ImpactCounter]:
    """Todos los contadores, garantizando que existan los del catálogo."""
    _seed(db)
    return list(db.scalars(select(ImpactCounter).order_by(ImpactCounter.key)).all())


def get_counter(db: Session, key: str) -> ImpactCounter:
    """Un contador por clave (siembra esa clave si aún no existe)."""
    _seed(db)
    row = db.get(ImpactCounter, key)
    if row is None:
        raise UnknownCounter(key)
    return row


def set_value(db: Session, key: str, value: int) -> ImpactCounter:
    """Fija el valor de un contador (lo crea con su etiqueta por defecto si falta)."""
    row = get_counter(db, key)
    row.value = _clamp(value)
    db.commit()
    db.refresh(row)
    return row


def adjust(db: Session, key: str, delta: int) -> ImpactCounter:
    """Suma/resta unidades (el panel admin usa +1/-1). Nunca baja de 0."""
    row = get_counter(db, key)
    row.value = _clamp(row.value + int(delta))
    db.commit()
    db.refresh(row)
    return row


def _clamp(value: int) -> int:
    return max(MIN_VALUE, min(int(value), MAX_VALUE))


def to_dict(row: ImpactCounter) -> dict:
    return {
        "key": row.key,
        "value": row.value,
        "label": row.label,
        "unit": row.unit,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
    }
