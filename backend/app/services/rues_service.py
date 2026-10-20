"""Persistencia de registros RUES en su propia tabla (`rues_records`).

El registro oficial vive aquí, con el NIT como clave: cada NIT es su propia
fila y nunca pisa a otro. La cuenta solo conserva el NIT que la identifica.
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.rues import RuesRecord

# Campos del contrato normalizado de `nit_service` que se persisten por columna.
_MAPA: tuple[tuple[str, str], ...] = (
    ("digito_verificacion", "digito_verificacion"),
    ("razon_social", "razon_social"),
    ("representante_legal", "representante_legal"),
    ("identificacion_representante", "identificacion_representante"),
    ("camara_comercio", "camara_comercio"),
    ("matricula", "matricula"),
    ("estado_matricula", "estado_matricula"),
    ("organizacion_juridica", "organizacion_juridica"),
    ("tipo_sociedad", "tipo_sociedad"),
    ("categoria_matricula", "categoria_matricula"),
    ("actividad_economica", "actividad_economica"),
    ("fecha_matricula", "fecha_matricula"),
    ("ultimo_ano_renovado", "ultimo_ano_renovado"),
    ("fecha_actualizacion", "fecha_actualizacion"),
    ("fuente", "fuente"),
)


def upsert(db: Session, *, nit: str, data: dict, consulted_by: str | None = None) -> RuesRecord:
    """Guarda (o refresca) el registro RUES de un NIT. Devuelve la fila.

    `nit` es la clave normalizada (sin dígito de verificación) devuelta por el
    servicio de consulta. Idempotente: si ya existe, actualiza los campos y la
    fecha de consulta.
    """
    registro = db.get(RuesRecord, nit)
    ahora = datetime.now(timezone.utc)
    if registro is None:
        registro = RuesRecord(nit=nit, consulted_at=ahora)
        db.add(registro)

    for origen, destino in _MAPA:
        setattr(registro, destino, data.get(origen))
    registro.consulted_by = consulted_by
    registro.consulted_at = ahora

    db.commit()
    db.refresh(registro)
    return registro


def get(db: Session, nit: str) -> RuesRecord | None:
    """Recupera el registro RUES cacheado de un NIT, si existe."""
    return db.get(RuesRecord, nit)


def delete(db: Session, nit: str) -> bool:
    """Elimina el registro RUES cacheado de un NIT. Devuelve True si existía."""
    registro = db.get(RuesRecord, nit)
    if registro is None:
        return False
    db.delete(registro)
    db.commit()
    return True
