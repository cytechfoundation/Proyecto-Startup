"""Catálogo de herramientas: wrappers con nombre sobre libs OSS y binarios locales.

Cada entrada declara su esquema de parámetros y su propia lógica de ejecución.
El cliente solo envía *datos* (ids de archivos y valores), nunca comandos ni
rutas: la disponibilidad se descubre en el servidor (`shutil.which` /
`find_spec`) y se informa en `GET /tools`.

Las librerías no instaladas y los binarios ausentes simplemente aparecen como
`available: false` (la plataforma sigue funcionando).
"""
from __future__ import annotations

import importlib.util
import json
import re
import tempfile
import zipfile
from pathlib import Path

from app.core.config import settings
from app.services.tools import files, runner
from app.services.tools.base import (
    Param, RunContext, ToolFileError, ToolNotFound, ToolParamsError, ToolResult, ToolSpec, ToolUnavailable,
)

REGISTRY: dict[str, ToolSpec] = {}

_SAFE_TOKEN = re.compile(r"^[A-Za-z0-9._+-]{1,24}$")


def tool(name: str, *, kind: str, title: str, description: str, params: dict | None = None,
         binary: str | None = None, module: str | None = None,
         version_argv: tuple[str, ...] | None = None, argv_builder=None, output_builder=None):
    """Registra una herramienta. `fn` recibe (params, ctx) y devuelve dict."""
    def decorator(fn):
        spec = ToolSpec(name=name, kind=kind, title=title, description=description,
                        params=params or {}, binary=binary, module=module,
                        version_argv=version_argv, argv_builder=argv_builder,
                        executor=fn, output_builder=output_builder)
        REGISTRY[name] = spec
        return fn
    return decorator


# ======================================================================
# Librerías de código abierto (Python)
# ======================================================================
@tool("pdf.info", kind="library", title="Info de PDF", module="pypdf",
      description="Mete datos de un PDF subido: número de páginas, si está cifrado, metadatos y hash.",
      params={"file": Param("str", True, "Id del archivo devuelto por POST /tools/files")})
def _pdf_info(p: dict, ctx: RunContext) -> dict:
    from pypdf import PdfReader

    path = files.resolve(p["file"])
    reader = PdfReader(str(path))
    meta = {str(k): str(v) for k, v in (reader.metadata or {}).items()}
    raw = path.read_bytes()
    return {"ok": True, "output": {
        "name": path.name.split("__", 1)[-1], "pages": len(reader.pages),
        "encrypted": bool(reader.is_encrypted), "metadata": meta,
        "size": len(raw), "sha256": files.sha256(raw),
    }}


@tool("pdf.extract", kind="library", title="Texto de PDF", module="pypdf",
      description="Extrae el texto real de un PDF (rango de páginas opcional, p. ej. '1-3').",
      params={"file": Param("str", True, "Id del archivo"),
              "pages": Param("str", False, "Rango 1-based: '2', '1-3' (por defecto, todas)")})
def _pdf_extract(p: dict, ctx: RunContext) -> dict:
    from pypdf import PdfReader

    path = files.resolve(p["file"])
    reader = PdfReader(str(path))
    total = len(reader.pages)
    idxs = _parse_range(p.get("pages"), total)
    texto = "".join((reader.pages[i].extract_text() or "") for i in idxs)
    return {"ok": True, "output": {
        "pages_read": [i + 1 for i in idxs], "total_pages": total,
        "chars": len(texto), "text": texto,
    }}


@tool("pdf.merge", kind="library", title="Fusionar PDFs", module="pypdf",
      description="Une varios PDFs en uno solo y devuelve el id del archivo generado.",
      params={"files": Param("list[str]", True, "Lista de ids, en el orden de fusión"),
              "name": Param("str", False, "Nombre del resultado (por defecto, fusionado.pdf)")})
def _pdf_merge(p: dict, ctx: RunContext) -> dict:
    from pypdf import PdfReader, PdfWriter

    paths = files.resolve_many(p["files"])
    writer = PdfWriter()
    for path in paths:
        for page in PdfReader(str(path)).pages:
            writer.add_page(page)
    name = files.safe_name(p.get("name") or "fusionado.pdf")
    with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp:
        tmp_path = Path(tmp.name)
    try:
        with tmp_path.open("wb") as fh:
            writer.write(fh)
        ficha = files.store_generated(tmp_path, name)
    finally:
        tmp_path.unlink(missing_ok=True)
    return {"ok": True, "output": {"file": ficha["id"], "name": ficha["name"],
                                   "size": ficha["size"], "sources": [x.name for x in paths]}}


@tool("text.stats", kind="library", title="Estadísticas de texto", module=None,
      description="Cuenta bytes, líneas y palabras de un archivo y calcula su hash (stdlib).",
      params={"file": Param("str", True, "Id del archivo")})
def _text_stats(p: dict, ctx: RunContext) -> dict:
    path = files.resolve(p["file"])
    raw = path.read_bytes()
    text = raw.decode("utf-8", errors="replace")
    return {"ok": True, "output": {
        "name": path.name.split("__", 1)[-1], "bytes": len(raw), "chars": len(text),
        "lines": len(text.splitlines()), "words": len(text.split()),
        "sha256": files.sha256(raw),
    }}


@tool("zip.list", kind="library", title="Contenido de ZIP", module="zipfile",
      description="Lista las entradas de un archivo comprimido (nombre, tamaño, comprimido).",
      params={"file": Param("str", True, "Id del archivo"),
              "limit": Param("int", False, "Máximo de entradas a devolver", 50)})
def _zip_list(p: dict, ctx: RunContext) -> dict:
    path = files.resolve(p["file"])
    try:
        zf = zipfile.ZipFile(path)
    except zipfile.BadZipFile:
        raise ToolFileError("El archivo no es un ZIP válido")
    with zf:
        entries = [{"name": i.filename, "size": i.file_size, "compressed": i.compress_size}
                   for i in zf.infolist()]
    limit = max(1, min(int(p.get("limit", 50)), 500))
    return {"ok": True, "output": {"total": len(entries), "entries": entries[:limit],
                                   "truncated": len(entries) > limit}}


@tool("image.info", kind="library", title="Info de imagen", module="PIL",
      description="Dimensiones, modo de color y formato de una imagen (Pillow, opcional).",
      params={"file": Param("str", True, "Id del archivo")})
def _image_info(p: dict, ctx: RunContext) -> dict:
    from PIL import Image

    path = files.resolve(p["file"])
    with Image.open(path) as img:
        return {"ok": True, "output": {"format": img.format, "mode": img.mode,
                                       "width": img.width, "height": img.height,
                                       "size": path.stat().st_size}}


@tool("xlsx.rows", kind="library", title="Filas de Excel", module="openpyxl",
      description="Lee las primeras filas de una hoja de cálculo y las devuelve como JSON.",
      params={"file": Param("str", True, "Id del archivo"),
              "sheet": Param("str", False, "Nombre de la hoja (por defecto, la primera)"),
              "max_rows": Param("int", False, "Filas máximo", 20)})
def _xlsx_rows(p: dict, ctx: RunContext) -> dict:
    from openpyxl import load_workbook

    path = files.resolve(p["file"])
    wb = load_workbook(filename=str(path), read_only=True, data_only=True)
    try:
        name = p.get("sheet") or wb.sheetnames[0]
        if name not in wb.sheetnames:
            raise ToolParamsError(f"Hoja '{name}' inexistente. Disponibles: {', '.join(wb.sheetnames)}")
        ws = wb[name]
        limit = max(1, min(int(p.get("max_rows", 20)), 500))
        rows = [[c if c is not None else None for c in row] for row in ws.iter_rows(max_row=limit, values_only=True)]
    finally:
        wb.close()
    return {"ok": True, "output": {"sheet": name, "rows": rows, "returned": len(rows)}}


# ======================================================================
# Binarios locales del sistema (descubiertos con shutil.which)
# ======================================================================
def _bin_available(spec: ToolSpec) -> str | None:
    return runner.which(spec.binary) if spec.binary else None


@tool("git.version", kind="binary", title="Versión de git", binary="git",
      version_argv=("git", "--version"),
      description="Versión del binario git instalado en el servidor (smoke test del runner).",
      argv_builder=lambda p: ["--version"],
      output_builder=lambda res: {"version": (res.stdout or "").strip()})
def _git_version(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — vía runner
    raise NotImplementedError


@tool("node.version", kind="binary", title="Versión de Node.js", binary="node",
      version_argv=("node", "--version"),
      description="Versión del runtime Node.js instalado (lo usa el notifier).",
      argv_builder=lambda p: ["--version"],
      output_builder=lambda res: {"version": (res.stdout or "").strip()})
def _node_version(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — vía runner
    raise NotImplementedError


def _check_format(value: str) -> str:
    """Acepta solo tokens simples (pdf, txt:Text, png) para no inyectar argumentos."""
    value = (value or "").strip()
    if not _SAFE_TOKEN.fullmatch(value):
        raise ToolParamsError("Formato no válido: usa tokens simples como 'pdf', 'txt' o 'png'")
    return value


@tool("pdfinfo.meta", kind="binary", title="Metadatos con pdfinfo", binary="pdfinfo",
      version_argv=("pdfinfo", "-v"),
      description="Metadatos del PDF usando la utilidad del sistema Poppler (alternativa nativa a pypdf).",
      params={"file": Param("str", True, "Id del archivo")},
      argv_builder=lambda p: [str(files.resolve(p["file"]))],
      output_builder=lambda res: {"fields": _parse_keyvalues(res.stdout or "")})
def _pdfinfo(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — vía runner
    raise NotImplementedError


@tool("pdftotext.extract", kind="binary", title="Texto con pdftotext", binary="pdftotext",
      version_argv=("pdftotext", "-v"),
      description="Extrae el texto de un PDF con Poppler conservando el layout de tablas.",
      params={"file": Param("str", True, "Id del archivo"),
              "layout": Param("bool", False, " Conservar layout de columnas", True)},
      argv_builder=lambda p: (["-layout"] if p.get("layout", True) else []) + [str(files.resolve(p["file"])), "-"],
      output_builder=lambda res: {"chars": len(res.stdout or ""), "text": res.stdout or ""})
def _pdftotext(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — vía runner
    raise NotImplementedError


@tool("ffprobe.probe", kind="binary", title="Análisis de audio/video", binary="ffprobe",
      version_argv=("ffprobe", "-version"),
      description="Formato, duración y pistas de un archivo multimedia (FFmpeg).",
      params={"file": Param("str", True, "Id del archivo")},
      argv_builder=lambda p: ["-v", "error", "-print_format", "json", "-show_format", "-show_streams",
                              str(files.resolve(p["file"]))],
      output_builder=lambda res: json.loads(res.stdout or "{}"))
def _ffprobe(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — vía runner
    raise NotImplementedError


@tool("soffice.convert", kind="binary", title="Convertir documento (LibreOffice)", binary="soffice",
      version_argv=("soffice", "--version"),
      description="Convierte un documento a otro formato en modo headless y devuelve el archivo generado.",
      params={"file": Param("str", True, "Id del archivo"),
              "format": Param("str", False, "Formato de salida: pdf, txt, csv, docx…", "pdf")},
      argv_builder=lambda p: ["--headless", "--convert-to", _check_format(p.get("format", "pdf")),
                              "--outdir", p["_outdir"], str(files.resolve(p["file"]))])
def _soffice(p: dict, ctx: RunContext) -> dict:  # pragma: no cover — requiere LibreOffice
    from app.services.tools.runner import run_command

    with tempfile.TemporaryDirectory(prefix="cytech-convert-") as tmp:
        p["_outdir"] = tmp
        binary = _bin_available(REGISTRY["soffice.convert"])
        result = run_command([binary, *REGISTRY["soffice.convert"].argv_builder(p)],
                             tool="soffice.convert", timeout=ctx.timeout)
        produced = [x for x in Path(tmp).iterdir() if x.is_file()]
        if not result.ok or not produced:
            return result.to_dict() | {"ok": False,
                                       "stderr": result.stderr or "LibreOffice no produjo ningún archivo"}
        ficha = files.store_generated(produced[0], produced[0].name)
    return {"ok": True, "output": {"file": ficha["id"], "name": ficha["name"], "size": ficha["size"]}}


# ======================================================================
# Descubrimiento, salud y ejecución
# ======================================================================
def _parse_keyvalues(text: str) -> dict:
    out = {}
    for line in text.splitlines():
        if ":" in line:
            k, _, v = line.partition(":")
            out[k.strip()] = v.strip()
    return out


def _parse_range(value: str | None, total: int) -> list[int]:
    """Convierte '1-3' o '2' en índices 0-based válidos."""
    if not value:
        return list(range(total))
    value = value.strip()
    if m := re.fullmatch(r"(\d+)(?:\s*-\s*(\d+))?", value):
        start = max(int(m.group(1)), 1)
        end = max(int(m.group(2) or start), start)
    else:
        raise ToolParamsError("Rango de páginas no válido: usa '2' o '1-3'")
    end = min(end, total)
    if start > total:
        raise ToolParamsError(f"El PDF solo tiene {total} página(s)")
    return list(range(start - 1, end))


def is_available(spec: ToolSpec) -> bool:
    try:
        if spec.kind == "binary":
            return bool(_bin_available(spec))
        return spec.module is None or importlib.util.find_spec(spec.module) is not None
    except (ImportError, ValueError):
        return False


def describe(spec: ToolSpec, *, detail: bool = False) -> dict:
    available = is_available(spec)
    d = {
        "name": spec.name,
        "kind": spec.kind,
        "title": spec.title,
        "description": spec.description,
        "available": available,
        "params": spec.param_schema(),
        "requires_file": bool(spec.params),
    }
    if spec.kind == "binary":
        d["binary"] = spec.binary
        d["binary_path"] = _bin_available(spec)
    else:
        d["module"] = spec.module or "stdlib"
    if detail:
        d["note"] = spec.note
        if available and spec.version_argv:
            path = _bin_available(spec)
            if path:
                res = runner.run_command([path, *spec.version_argv[1:]], tool=spec.name, timeout=8)
                d["version"] = (res.stdout or res.stderr or "").strip().splitlines()[:1]
                d["version"] = d["version"][0] if d["version"] else None
    return d


def inventory(detail: bool = False) -> list[dict]:
    return [describe(s, detail=detail) for s in REGISTRY.values()]


def validate_params(spec: ToolSpec, raw: dict | None) -> dict:
    raw = dict(raw or {})
    unknown = sorted(set(raw) - set(spec.params))
    if unknown:
        raise ToolParamsError(
            f"Parámetros no admitidos: {', '.join(unknown)}. "
            f"Esta herramienta admite: {', '.join(spec.params) or 'ninguno'}."
        )
    out: dict = {}
    for name, prm in spec.params.items():
        if name in raw and raw[name] is not None:
            out[name] = _coerce(name, prm.type, raw[name])
        elif prm.default is not None:
            out[name] = prm.default
        elif prm.required:
            raise ToolParamsError(
                f"Falta el parámetro obligatorio '{name}'"
                + (f" ({prm.description})" if prm.description else "")
            )
    return out


def _coerce(name: str, ptype: str, value):
    if ptype == "str":
        if not isinstance(value, str):
            raise ToolParamsError(f"'{name}' debe ser texto")
        return value
    if ptype == "int":
        if isinstance(value, bool) or not isinstance(value, (int, str)):
            raise ToolParamsError(f"'{name}' debe ser un número entero")
        try:
            return int(value)
        except ValueError:
            raise ToolParamsError(f"'{name}' debe ser un número entero")
    if ptype == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.lower() in ("true", "false", "1", "0"):
            return value.lower() in ("true", "1")
        raise ToolParamsError(f"'{name}' debe ser booleano")
    if ptype == "list[str]":
        if isinstance(value, str):
            value = [value]
        if not isinstance(value, list) or not value or not all(isinstance(x, str) for x in value):
            raise ToolParamsError(f"'{name}' debe ser una lista no vacía de identificadores")
        return value
    raise ToolParamsError(f"Tipo de parámetro desconocido: {ptype}")


def clamp_timeout(value) -> int:
    try:
        t = int(value or settings.tools_default_timeout)
    except (TypeError, ValueError):
        raise ToolParamsError("El timeout debe ser un número de segundos")
    return max(1, min(t, settings.tools_max_timeout))


def run_tool(name: str, params: dict | None = None, timeout=None) -> ToolResult:
    """Ejecuta una herramienta registrada con validación y límites."""
    spec = REGISTRY.get(name)
    if spec is None:
        raise ToolNotFound(
            f"Herramienta '{name}' no existe. Consulta el catálogo en GET /api/v1/tools."
        )
    if not is_available(spec):
        raise ToolUnavailable(
            f"La herramienta '{name}' está registrada pero no disponible en este servidor "
            f"({spec.binary if spec.kind == 'binary' else spec.module})."
        )
    values = validate_params(spec, params)
    ctx = RunContext(files_dir=files.ensure_dir(), timeout=clamp_timeout(timeout))

    if spec.kind == "library":
        return _wrap(spec, spec.executor(values, ctx))

    binary = _bin_available(spec)
    result = runner.run_command([binary, *spec.argv_builder(values)], tool=spec.name, timeout=ctx.timeout)
    result.output = {"command": f"{spec.binary} {' '.join(argv_text(spec, values))}".strip()}
    if spec.output_builder and not result.timed_out:
        try:
            extra = spec.output_builder(result)
            if isinstance(extra, dict):
                result.output.update(extra)
        except Exception as exc:  # salida inesperada: se informa, no se rompe
            result.output["parse_error"] = str(exc)
    return result


def argv_text(spec: ToolSpec, values: dict) -> list[str]:
    """argv sin resolver rutas absolutas (solo para el eco depurativo)."""
    args = spec.argv_builder(dict(values))
    return [a.replace(str(files.TOOLS_DIR), "<files>") for a in args]


def _wrap(spec: ToolSpec, payload) -> ToolResult:
    if isinstance(payload, ToolResult):
        return payload
    if isinstance(payload, dict) and {"ok", "output"} <= set(payload):
        return ToolResult(tool=spec.name, ok=bool(payload["ok"]), output=payload.get("output", {}))
    return ToolResult(tool=spec.name, ok=True, output=payload if isinstance(payload, dict) else {"result": payload})
