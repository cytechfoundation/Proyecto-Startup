"""Consulta de NIT contra los datos abiertos del RUES (Confecámaras).

Fuente: dataset `c82u-588k` de datos.gov.co (Socrata), que publica el
Registro Único Empresarial y Social administrado por Confecámaras. Es la vía
oficial y gratuita de consulta empresarial en Colombia (Decreto 19 de 2012).

El dataset indexa el NIT **sin dígito de verificación**, así que si la
consulta exacta no devuelve nada se reintenta recortando los últimos dígitos
(hasta agotar los candidatos) para tolerar NIT escritos con verificador.
"""
from __future__ import annotations

import httpx

# Dataset Socrata de Confecámaras/RUES en datos.gov.co.
DATASET_ID = "c82u-588k"
_BASE = f"https://www.datos.gov.co/resource/{DATASET_ID}.json"
_TIMEOUT = 20.0
_MAX_CANDIDATES = 3  # intentos recortando el dígito de verificación


class NitError(Exception):
    """Error controlado de la consulta (red, timeout o API no disponible)."""


def _digits(raw: str) -> str:
    """Conserva solo dígitos de la entrada del usuario (quita puntos/guiones/espacios)."""
    return "".join(ch for ch in str(raw or "") if ch.isdigit())


def _query(nit: str) -> list[dict]:
    try:
        r = httpx.get(
            _BASE,
            params={"nit": nit, "$limit": "1"},
            timeout=_TIMEOUT,
            headers={"Accept": "application/json"},
        )
    except httpx.HTTPError as exc:  # red / timeout
        raise NitError("No se pudo contactar datos.gov.co") from exc
    if r.status_code != 200:
        raise NitError(f"datos.gov.co respondió HTTP {r.status_code}")
    try:
        return r.json()
    except ValueError as exc:
        raise NitError("Respuesta inválida de datos.gov.co") from exc


def _normalize(row: dict) -> dict:
    """Mapea las columnas de Socrata a un contrato estable para el frontend."""

    def s(key: str) -> str | None:
        v = row.get(key)
        v = str(v).strip() if v is not None else None
        return v or None

    fecha_matricula = s("fecha_matricula")
    if fecha_matricula and len(fecha_matricula) == 8 and fecha_matricula.isdigit():
        fecha_matricula = f"{fecha_matricula[6:8]}/{fecha_matricula[4:6]}/{fecha_matricula[0:4]}"

    return {
        "nit": s("nit") or s("numero_identificacion"),
        "digito_verificacion": s("digito_verificacion"),
        "razon_social": s("razon_social"),
        "representante_legal": s("representante_legal"),
        "identificacion_representante": s("num_identificacion_representante_legal"),
        "camara_comercio": s("camara_comercio"),
        "matricula": s("matricula"),
        "estado_matricula": s("estado_matricula"),
        "organizacion_juridica": s("organizacion_juridica"),
        "tipo_sociedad": s("tipo_sociedad"),
        "categoria_matricula": s("categoria_matricula"),
        "actividad_economica": s("cod_ciiu_act_econ_pri"),
        "fecha_matricula": fecha_matricula,
        "ultimo_ano_renovado": s("ultimo_ano_renovado"),
        "fecha_actualizacion": s("fecha_actualizacion"),
        "fuente": "datos.gov.co · RUES (Confecámaras)",
    }


def lookup(raw_nit: str) -> dict | None:
    """Devuelve los datos públicos del NIT o `None` si no existe registro.

    Lanza :class:`NitError` cuando la fuente no responde (para que el endpoint
    distinga «no encontrado» de «sin conexión»).
    """
    clean = _digits(raw_nit)
    if len(clean) < 6:
        raise NitError("NIT demasiado corto (mínimo 6 dígitos)")

    # Intentos: NIT exacto y luego recortando el dígito de verificación final.
    candidates = [clean]
    for cut in range(1, _MAX_CANDIDATES + 1):
        if len(clean) - cut >= 6:
            candidates.append(clean[:-cut])

    for candidate in candidates:
        rows = _query(candidate)
        if rows:
            return _normalize(rows[0])
    return None
