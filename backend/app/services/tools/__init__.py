"""Capa de herramientas de Cytech: wrappers sobre librerías OSS y binarios locales.

Componentes:
  * `base`     — tipos (ToolSpec, ToolResult, errores normalizados).
  * `runner`   — ejecución acotada de binarios (sin shell, timeout, salida recortada).
  * `files`    — almacén de archivos por id (nunca se aceptan rutas del cliente).
  * `registry` — catálogo de herramientas + descubrimiento de disponibilidad.
"""
from app.services.tools import files, runner
from app.services.tools.base import (
    Param,
    RunContext,
    ToolError,
    ToolFileError,
    ToolNotFound,
    ToolParamsError,
    ToolResult,
    ToolSpec,
    ToolUnavailable,
)
from app.services.tools.registry import REGISTRY, describe, inventory, is_available, run_tool

__all__ = [
    "files", "runner", "registry", "Param", "RunContext", "ToolError", "ToolFileError",
    "ToolNotFound", "ToolParamsError", "ToolResult", "ToolSpec", "ToolUnavailable",
    "REGISTRY", "describe", "inventory", "is_available", "run_tool",
]
