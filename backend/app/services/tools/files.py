"""Almacén de archivos que alimentan las herramientas (uploads admin).

El cliente nunca envía rutas: sube un archivo y recibe un **id** (`<hex>`), que
es el único identificador que después aceptan las herramientas. La resolución
comprueba formato del id y pertenencia al directorio, así que un `../` o una
ruta absoluta se rechaza antes de tocar el disco.

Layout: `data/tools/<id>__<nombre_original_sanitizado>`.
"""
from __future__ import annotations

import hashlib
import re
import shutil
import unicodedata
from pathlib import Path

from app.core.config import settings
from app.services.tools.base import FILE_ID_RE, ToolFileError, ToolParamsError

# raíz del proyecto backend/ (…/backend/app/services/tools/files.py -> parents[3])
_ROOT = Path(__file__).resolve().parents[3]
TOOLS_DIR = (_ROOT / settings.tools_dir).resolve() if not Path(settings.tools_dir).is_absolute() \
    else Path(settings.tools_dir).resolve()

MAX_UPLOAD_BYTES = settings.tools_max_upload_mb * 1024 * 1024  # valor inicial (se recalcula en save)
_NAME_SAFE = re.compile(r"[^A-Za-z0-9._-]+")


class UploadTooLarge(ToolParamsError):
    """El archivo supera el máximo permitido."""


def ensure_dir() -> Path:
    TOOLS_DIR.mkdir(parents=True, exist_ok=True)
    return TOOLS_DIR


def safe_name(name: str) -> str:
    """Nombre visible sin caracteres peligrosos (conserva acentos solo si son seguros)."""
    base = Path(name or "archivo").name                     # elimina directorios
    base = unicodedata.normalize("NFC", base)
    base = _NAME_SAFE.sub("_", base).strip("._") or "archivo"
    return base[:80]


def save(filename: str, content: bytes, *, suffix_check: bool = False) -> dict:
    """Guarda un upload y devuelve su ficha (id, nombre, tamaño, sha256)."""
    if not content:
        raise ToolParamsError("El archivo está vacío")
    max_bytes = settings.tools_max_upload_mb * 1024 * 1024  # se lee en cada subida (configurable)
    if len(content) > max_bytes:
        raise UploadTooLarge(f"El archivo supera el máximo de {settings.tools_max_upload_mb} MB")

    ensure_dir()
    file_id = hashlib.sha256(content + str(len(content)).encode()).hexdigest()[:16]
    name = safe_name(filename)
    path = TOOLS_DIR / f"{file_id}__{name}"
    # Mismo contenido => mismo id: reutiliza el archivo en vez de duplicarlo.
    if not path.exists():
        for existing in TOOLS_DIR.glob(f"{file_id}__*"):
            if existing.read_bytes() == content:
                path = existing
                name = existing.name.split("__", 1)[1]
                break
        else:
            path.write_bytes(content)

    return {
        "id": file_id,
        "name": name,
        "size": len(content),
        "sha256": sha256(content),
    }


def resolve(ref: str) -> Path:
    """Convierte un id de archivo en una ruta dentro del almacén (o falla)."""
    ref = (ref or "").strip()
    if not FILE_ID_RE.fullmatch(ref):
        raise ToolParamsError(
            "Identificador de archivo no válido: usa el id devuelto por POST /tools/files "
            "(no se aceptan rutas)."
        )
    matches = sorted(TOOLS_DIR.glob(f"{ref}__*")) if TOOLS_DIR.exists() else []
    if not matches:
        raise ToolFileError(f"No existe ningún archivo con id '{ref}'. Súbelo primero con POST /tools/files.")
    return matches[0]


def resolve_many(refs: list[str]) -> list[Path]:
    if not isinstance(refs, list) or not refs:
        raise ToolParamsError("Se espera una lista no vacía de identificadores de archivo")
    return [resolve(r) for r in refs]


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def listing() -> list[dict]:
    """Inventario del almacén (id, nombre, tamaño, fecha)."""
    if not TOOLS_DIR.exists():
        return []
    out = []
    for p in sorted(TOOLS_DIR.iterdir()):
        if not p.is_file() or "__" not in p.name:
            continue
        fid, name = p.name.split("__", 1)
        stat = p.stat()
        out.append({"id": fid, "name": name, "size": stat.st_size,
                    "modified_at": int(stat.st_mtime)})
    return out


def delete(file_id: str) -> bool:
    ref = (file_id or "").strip()
    if not FILE_ID_RE.fullmatch(ref):
        raise ToolParamsError("Identificador de archivo no válido")
    removed = False
    for p in TOOLS_DIR.glob(f"{ref}__*"):
        p.unlink(missing_ok=True)
        removed = True
    return removed


def store_generated(path: Path, name: str) -> dict:
    """Registra un archivo producido por una herramienta (p. ej. un PDF fusionado)."""
    return save(name, path.read_bytes())


def clear() -> None:
    """Solo para pruebas: vacía el almacén."""
    if TOOLS_DIR.exists():
        shutil.rmtree(TOOLS_DIR, ignore_errors=True)
