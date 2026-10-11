"""Endpoints de la capa de herramientas (wrappers de libs OSS + binarios locales).

Solo administradores: el inventario revela qué software corre en el servidor y
las ejecuciones consumen CPU/disco. El runner es acotado (allowlist implícita
vía registro, sin shell, timeout y salida recortada), así que una ejecución
devuelve **200 aunque la herramienta falle**: el estado real está en `ok`,
`exit_code` y `stderr`.
"""
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel, Field

from app.core.security import require_admin
from app.models.user import User
from app.services.tools import files, registry
from app.services.tools.base import ToolFileError, ToolNotFound, ToolParamsError, ToolUnavailable

router = APIRouter(prefix="/tools", tags=["tools"])


class RunIn(BaseModel):
    params: dict = Field(
        default_factory=dict,
        description="Parámetros validados contra el esquema de la herramienta "
                    "(normalmente `file`: el id devuelto por POST /tools/files).",
    )
    timeout: int | None = Field(default=None, ge=1, le=60, description="Segundos máximos (default 15, máx 60).")


def _map(exc: Exception) -> HTTPException:
    if isinstance(exc, ToolNotFound):
        return HTTPException(404, str(exc))
    if isinstance(exc, ToolUnavailable):
        return HTTPException(409, str(exc))
    if isinstance(exc, (ToolParamsError, ToolFileError)):
        return HTTPException(422, str(exc))
    return HTTPException(500, f"Fallo inesperado en la capa de herramientas: {exc}")


# --------------------------------------------------------------- archivos
@router.get("/files")
def list_files(_: User = Depends(require_admin)):
    """Archivos subidos (inventario del almacén). Sus ids alimentan a las herramientas."""
    items = files.listing()
    return {"count": len(items), "files": items}


@router.post("/files", status_code=201)
async def upload_file(file: UploadFile = File(...), _: User = Depends(require_admin)):
    """Sube un archivo (multipart) y devuelve su `id`, que usas en `params.file`."""
    content = await file.read()
    try:
        ficha = files.save(file.filename or "archivo", content)
    except ToolParamsError as exc:
        raise HTTPException(422, str(exc))
    ficha["message"] = f"Archivo '{ficha['name']}' listo. Usa params.file = \"{ficha['id']}\"."
    return ficha


@router.delete("/files/{file_id}", status_code=204)
def delete_file(file_id: str, _: User = Depends(require_admin)):
    """Elimina un archivo subido (o los generados con ese id)."""
    try:
        if not files.delete(file_id):
            raise HTTPException(404, f"No existe ningún archivo con id '{file_id}'")
    except ToolParamsError as exc:
        raise HTTPException(422, str(exc))


# --------------------------------------------------------------- catálogo
@router.get("")
def list_tools(_: User = Depends(require_admin)):
    """Catálogo completo con disponibilidad real en este servidor."""
    items = registry.inventory()
    return {
        "count": len(items),
        "available": sum(1 for i in items if i["available"]),
        "tools": items,
    }


@router.get("/{name}")
def tool_detail(name: str, _: User = Depends(require_admin)):
    """Detalle de una herramienta: esquema de parámetros, binario/módulo y versión."""
    spec = registry.REGISTRY.get(name)
    if spec is None:
        raise HTTPException(404, f"Herramienta '{name}' no existe. Consulta GET /api/v1/tools.")
    return registry.describe(spec, detail=True)


@router.post("/{name}/run")
def run_tool(name: str, body: RunIn, _: User = Depends(require_admin)):
    """Ejecuta una herramienta acotada. Devuelve 200 aunque la herramienta falle:
    revisa `ok`, `exit_code` y `stderr` (útil para probarlo en ReadyAPI)."""
    try:
        result = registry.run_tool(name, body.params, timeout=body.timeout)
    except (ToolNotFound, ToolUnavailable, ToolParamsError, ToolFileError) as exc:
        raise _map(exc)
    except Exception as exc:  # el registro controla su executor; esto es un red de seguridad
        raise _map(exc)
    return result.to_dict()
