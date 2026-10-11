"""Almacén y registro de los PDFs del Calendario Tributario (uploads admin).

Al importar un calendario, el PDF original se guarda en disco
(`data/tax_calendar/<id>__<nombre>`) y se registra en la tabla `tax_uploads`,
de modo que el panel admin puede mostrar la lista ordenada de archivos subidos
(más reciente primero) con su nombre, tamaño, año y eventos importados.

Se reutilizan las convenciones del almacén de herramientas: id de 16 hex
derivado del contenido, nombre sanitizado y sha256; el cliente solo maneja ids.
"""
from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.tax_upload import TaxUpload
from app.services.tools.base import FILE_ID_RE
from app.services.tools.files import safe_name, sha256

# raíz del proyecto backend/ (…/backend/app/services/tax_uploads.py -> parents[2])
_ROOT = Path(__file__).resolve().parents[2]
TAX_DIR = (_ROOT / settings.tax_uploads_dir).resolve() if not Path(settings.tax_uploads_dir).is_absolute() \
    else Path(settings.tax_uploads_dir).resolve()
#: ubicación real por defecto; las pruebas redirigen TAX_DIR a un tmp.
DEFAULT_TAX_DIR = TAX_DIR


class TaxUploadTooLarge(ValueError):
    """El PDF supera el máximo permitido."""


def ensure_dir() -> Path:
    TAX_DIR.mkdir(parents=True, exist_ok=True)
    return TAX_DIR


def _file_id(content: bytes) -> str:
    """Id determinista: el mismo PDF siempre produce el mismo id (sin duplicados)."""
    return sha256(content)[:16]


def save_upload(db: Session, filename: str, content: bytes, year: int, result: dict) -> dict:
    """Guarda el PDF en disco y registra (o refresca) su fila en la BD.

    Reimportar el mismo archivo actualiza la fila existente en lugar de duplicarla,
    en línea con la idempotencia del importador.
    """
    max_bytes = settings.tax_max_upload_mb * 1024 * 1024
    if len(content) > max_bytes:
        raise TaxUploadTooLarge(f"El archivo supera el máximo de {settings.tax_max_upload_mb} MB")

    ensure_dir()
    fid = _file_id(content)
    name = safe_name(filename)
    path = TAX_DIR / f"{fid}__{name}"
    if not path.exists():
        # Un archivo previo con el mismo id puede tener otro nombre visible.
        previos = sorted(TAX_DIR.glob(f"{fid}__*"))
        if previos:
            path = previos[0]
            name = previos[0].name.split("__", 1)[1]
        else:
            path.write_bytes(content)

    row = db.get(TaxUpload, fid)
    if row is None:
        row = TaxUpload(id=fid)
        db.add(row)
    row.filename = name
    row.size = len(content)
    row.sha256 = sha256(content)
    row.year = year
    row.events_created = int(result.get("created", 0))
    row.events_duplicated = int(result.get("duplicates", 0))
    row.events_total = int(result.get("total", 0))
    row.uploaded_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(row)
    return to_dict(row)


def list_uploads(db: Session) -> list[dict]:
    """Lista ordenada: lo más reciente primero."""
    rows = db.scalars(
        select(TaxUpload).order_by(TaxUpload.uploaded_at.desc(), TaxUpload.id.desc())
    ).all()
    return [to_dict(r) for r in rows]


def get_upload(db: Session, upload_id: str) -> TaxUpload:
    """Una fila por id (None si no existe o el id es inválido)."""
    ref = (upload_id or "").strip()
    if not FILE_ID_RE.fullmatch(ref):
        return None
    return db.get(TaxUpload, ref)


def resolve(upload_id: str) -> Path | None:
    """Ruta del PDF en disco para un id válido (None si no está)."""
    ref = (upload_id or "").strip()
    if not FILE_ID_RE.fullmatch(ref):
        return None
    matches = sorted(TAX_DIR.glob(f"{ref}__*")) if TAX_DIR.exists() else []
    return matches[0] if matches else None


def delete_upload(db: Session, upload_id: str) -> TaxUpload | None:
    """Borra la fila y su archivo. Devuelve la fila borrada (None si no existía)."""
    row = get_upload(db, upload_id)
    if row is None:
        return None
    ficha = to_dict(row)
    db.delete(row)
    db.commit()
    archivo = resolve(upload_id)
    if archivo is not None:
        archivo.unlink(missing_ok=True)
    return ficha


def to_dict(row: TaxUpload) -> dict:
    return {
        "id": row.id,
        "filename": row.filename,
        "size": row.size,
        "sha256": row.sha256,
        "year": row.year,
        "events_created": row.events_created,
        "events_duplicated": row.events_duplicated,
        "events_total": row.events_total,
        "uploaded_at": row.uploaded_at.isoformat() if row.uploaded_at else None,
    }
