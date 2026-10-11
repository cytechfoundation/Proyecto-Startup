"""Tipos de la capa de herramientas: especificación, contexto y resultado.

Una "herramienta" es un *wrapper* con nombre sobre:
  * una librería de código abierto en Python (`kind="library"`: pypdf, Pillow…), o
  * un ejecutable local del sistema (`kind="binary"`: git, pdftotext, soffice…).

Nunca se expone un shell: cada herramienta declara su propio esquema de
parámetros y su propio constructor de argv, de modo que el cliente solo envía
datos, nunca comandos.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Literal

Kind = Literal["library", "binary"]

FILE_ID_RE = re.compile(r"^[a-f0-9]{8,32}$")

PARAM_TYPES = ("str", "int", "bool", "list[str]")


# ------------------------------------------------------------------ errores
class ToolError(Exception):
    """Error base de la capa; el endpoint lo traduce a un HTTP 4xx legible."""


class ToolNotFound(ToolError):
    """La herramienta no existe en el registro."""


class ToolUnavailable(ToolError):
    """La herramienta existe pero su librería/binario no está instalado."""


class ToolParamsError(ToolError):
    """Parámetros ausentes, de tipo incorrecto o inseguros."""


class ToolFileError(ToolError):
    """Archivo inexistente o fuera del almacén autorizado."""


# ------------------------------------------------------------------ tipos
@dataclass(frozen=True)
class Param:
    """Esquema de un parámetro (se publica en Swagger para probarlo en ReadyAPI)."""

    type: str = "str"                      # str | int | bool | list[str]
    required: bool = False
    description: str = ""
    default: Any = None

    def to_dict(self) -> dict:
        d = {"type": self.type, "required": self.required, "description": self.description}
        if self.default is not None:
            d["default"] = self.default
        return d


@dataclass
class RunContext:
    """Entorno de una ejecución: dónde viven los archivos y cuánto puede durar."""

    files_dir: Path
    timeout: int = 15


@dataclass
class ToolSpec:
    name: str
    kind: Kind
    title: str
    description: str
    params: dict[str, Param] = field(default_factory=dict)
    binary: str | None = None             # ejecutable a resolver con shutil.which
    module: str | None = None             # módulo python a comprobar con find_spec
    version_argv: tuple[str, ...] | None = None   # p. ej. ("git", "--version")
    argv_builder: Callable[[dict], list[str]] | None = None   # binarios
    executor: Callable[[dict, RunContext], dict] | None = None  # librerías
    output_builder: Callable[[ToolResult, dict], dict] | None = None  # parsea stdout del binario
    available: bool = True                # se recalcula en cada consulta de salud
    note: str = ""

    def param_schema(self) -> dict[str, dict]:
        return {k: v.to_dict() for k, v in self.params.items()}


@dataclass
class ToolResult:
    """Salida normalizada de una ejecución (igual para libs y binarios)."""

    tool: str
    ok: bool
    output: dict = field(default_factory=dict)
    stdout: str | None = None
    stderr: str | None = None
    exit_code: int | None = None
    duration_ms: int = 0
    truncated: bool = False
    timed_out: bool = False

    def to_dict(self) -> dict:
        return {
            "tool": self.tool,
            "ok": self.ok,
            "output": self.output,
            "stdout": self.stdout,
            "stderr": self.stderr,
            "exit_code": self.exit_code,
            "duration_ms": self.duration_ms,
            "truncated": self.truncated,
            "timed_out": self.timed_out,
        }
