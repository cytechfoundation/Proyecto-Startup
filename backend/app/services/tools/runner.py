"""Ejecución segura de binarios locales (el corazón del wrapper "binary").

Reglas de seguridad (no negociables):
  * `shell=False`: nunca se arma una cadena de comandos, solo `argv` en lista.
  * El ejecutable se resuelve en el servidor con `shutil.which`; el cliente solo
    envía *datos* (el nombre de la herramienta ya está en el registro).
  * Entorno reducido: PATH/LANG/HOME temporal. No se heredan credenciales.
  * Cwd temporal por ejecución, eliminada al terminar (aunque falle).
  * Timeout duro y salida recortada a un tope configurable.
"""
from __future__ import annotations

import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path

from app.core.config import settings
from app.services.tools.base import ToolResult

MAX_OUTPUT_BYTES = settings.tools_max_output_kb * 1024


def which(binary: str) -> str | None:
    """Ruta absoluta del ejecutable en el PATH del sistema, o None si no existe."""
    return shutil.which(binary)


def _clean_env(home: Path) -> dict[str, str]:
    env = {
        "PATH": os.environ.get("PATH", "/usr/bin:/bin"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "LC_ALL": os.environ.get("LC_ALL", "C.UTF-8"),
        "HOME": str(home),
        "TMPDIR": str(home),
    }
    # Node/Java necesitan su propio cache; solo se copian si ya existen.
    for key in ("NODE_PATH", "JAVA_HOME"):
        if os.environ.get(key):
            env[key] = os.environ[key]
    return env


def _clip(text: str, limit: int = MAX_OUTPUT_BYTES) -> tuple[str, bool]:
    raw = text.encode("utf-8", errors="replace")
    if len(raw) <= limit:
        return text, False
    return raw[:limit].decode("utf-8", errors="replace") + "\n…[salida recortada]", True


def run_command(
    argv: list[str],
    *,
    tool: str = "binario",
    timeout: int | None = None,
    cwd: str | Path | None = None,
    stdin: str | None = None,
    env_extra: dict[str, str] | None = None,
    ok_codes: tuple[int, ...] = (0,),
) -> ToolResult:
    """Ejecuta `argv` con límites y devuelve un ToolResult normalizado."""
    if not argv or not all(isinstance(a, str) for a in argv):
        raise ValueError("argv debe ser una lista no vacía de cadenas")

    timeout = max(1, min(int(timeout or settings.tools_default_timeout), settings.tools_max_timeout))
    started = time.perf_counter()

    with tempfile.TemporaryDirectory(prefix="cytech-tool-") as tmp:
        home = Path(tmp)
        env = _clean_env(home)
        if env_extra:
            env.update(env_extra)
        workdir = Path(cwd) if cwd else home
        try:
            proc = subprocess.run(  # noqa: S603 — argv en lista, sin shell
                argv,
                cwd=str(workdir),
                env=env,
                input=stdin,
                capture_output=True,
                text=True,
                errors="replace",
                timeout=timeout,
            )
            stdout, out_trunc = _clip(proc.stdout or "")
            stderr, err_trunc = _clip(proc.stderr or "")
            duration = int((time.perf_counter() - started) * 1000)
            return ToolResult(
                tool=tool,
                ok=proc.returncode in ok_codes,
                stdout=stdout,
                stderr=stderr,
                exit_code=proc.returncode,
                duration_ms=duration,
                truncated=out_trunc or err_trunc,
            )
        except subprocess.TimeoutExpired as exc:
            duration = int((time.perf_counter() - started) * 1000)
            out = (exc.stdout or "") if isinstance(exc.stdout, str) else ""
            return ToolResult(
                tool=tool,
                ok=False,
                stdout=_clip(out)[0],
                stderr=f"Tiempo agotado tras {timeout}s",
                exit_code=None,
                duration_ms=duration,
                truncated=_clip(out)[1],
                timed_out=True,
            )
        except FileNotFoundError:
            duration = int((time.perf_counter() - started) * 1000)
            return ToolResult(
                tool=tool,
                ok=False,
                stderr=f"Ejecutable no encontrado: {argv[0]}",
                exit_code=127,
                duration_ms=duration,
            )
        except OSError as exc:  # permisos, binario incompatible con la arquitectura…
            duration = int((time.perf_counter() - started) * 1000)
            return ToolResult(tool=tool, ok=False, stderr=f"No se pudo ejecutar: {exc}",
                              exit_code=126, duration_ms=duration)
