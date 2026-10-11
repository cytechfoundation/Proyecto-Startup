"""Servicio para importar y gestionar el calendario tributario."""
import io
import re
import unicodedata
from datetime import date, datetime, timedelta, timezone
from sqlalchemy import delete, func, select
from sqlalchemy.orm import Session
from app.models.tax_calendar import TaxCalendar

"""Extraccion de texto desde PDF."""

PDF_MAGIC = b"%PDF"
MAX_PDF_BYTES = 12 * 1024 * 1024  # 12 MB


class PDFReadError(ValueError):
    """El PDF no pudo ser leido o no contiene texto extraible."""


def is_pdf(content: bytes) -> bool:
    """Valida la firma magica del PDF (tolerante a BOM/espacios previos)."""
    return PDF_MAGIC in content[:1024]


def extract_pdf_text(content: bytes) -> str:
    """
    Extrae el texto de todas las paginas de un PDF con pypdf.
    Lanza PDFReadError si el archivo esta vacio, es corrupto o no tiene texto
    (p. ej. un escaneo sin capa de texto).
    """
    if not content:
        raise PDFReadError("El archivo esta vacio.")
    if not is_pdf(content):
        raise PDFReadError("El archivo no tiene formato PDF valido (falta la firma %PDF).")
    if len(content) > MAX_PDF_BYTES:
        raise PDFReadError(f"El PDF supera el tamano maximo de {MAX_PDF_BYTES // (1024 * 1024)} MB.")

    try:
        from pypdf import PdfReader
    except ImportError as exc:  # pragma: no cover - dependencia de entorno
        raise PDFReadError("La libreria pypdf no esta instalada en el backend.") from exc

    try:
        reader = PdfReader(io.BytesIO(content))
        pages = [(page.extract_text() or "") for page in reader.pages]
    except Exception as exc:
        raise PDFReadError(f"No se pudo leer el PDF: {exc}") from exc

    text = "\n".join(pages).strip()
    if not text:
        raise PDFReadError(
            "El PDF no contiene texto extraible. Si es un escaneo, habilite OCR antes de importarlo."
        )
    return text


# ---------------------------------------------------------------------------
# Parseo del texto del Calendario Tributario
# ---------------------------------------------------------------------------

_MESES_LARGO = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}
_MESES_CORTO = {
    "ene": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}
_MESES_TODOS = {**_MESES_LARGO, **_MESES_CORTO}

# Categorias deducidas del rotulo de la seccion/linea.
_CATEGORIAS = [
    (r"\brenta\b", "Renta"),
    (r"\biva\b|impuesto sobre las ventas", "IVA"),
    (r"\bretenci", "Retención en la fuente"),
    (r"\brst\b|r[eé]gimen simple", "RST"),
    (r"\bpes\b|presencia econ[oó]mica", "PES"),
    (r"\bpatrimonio\b", "Patrimonio"),
    (r"\bconsumo\b", "Consumo"),
    (r"gasolina|\bacpm\b|combustibles", "Gasolina y ACPM"),
    (r"carbono", "Impuesto al Carbono"),
    (r"pl[aá]stico|bolsa", "Plásticos de un solo uso"),
    (r"bebida|ultraprocesad", "Bebidas ultraprocesadas"),
    (r"\brub\b|beneficiarios finales", "RUB"),
    (r"precios de transferencia", "Precios de transferencia"),
    (r"activos en el exterior", "Activos en el exterior"),
]
_CATEGORIA_RE = [(re.compile(p, re.IGNORECASE), c) for p, c in _CATEGORIAS]

# Rotulos que NO son obligaciones (ruido de encabezado/tabla).
_NO_OBLIGACION = re.compile(
    r"^(hasta|periodo|fecha|d[ií]a|d[ií]as|d[ií]gito|n[úu]mero|tramite|"
    r"total|p[aá]gina|dian|calendario|impuestos|aduanas|nacional|direcci[oó]n|"
    r"rep[uú]blica|colombia|resoluci[oó]n|nit|vencimiento|"
    r"[\d\s\-/\.:]+)$",
    re.IGNORECASE,
)


def _sin_acentos(text: str) -> str:
    return "".join(
        c for c in unicodedata.normalize("NFD", str(text))
        if unicodedata.category(c) != "Mn"
    )


def _mes_de(token: str) -> int:
    """Resuelve un token de mes (largo o corto, con o sin acentos) a 1-12."""
    return _MESES_TODOS.get(_sin_acentos(token).lower(), 0)


def _deducir_categoria(*texts: str) -> str:
    blob = " ".join(t for t in texts if t)
    for pattern, nombre in _CATEGORIA_RE:
        if pattern.search(blob):
            return nombre
    return "General"


def _lineas(text: str) -> list[str]:
    """Normaliza el texto: colapsa espacios y descarta lineas vacias."""
    out = []
    for raw in text.splitlines():
        line = re.sub(r"[ \t ]+", " ", raw).strip()
        if line:
            out.append(line)
    return out


def _enteros(token: str) -> list[int]:
    """Extrae todos los enteros de 1-2 cifras de un token (candidatos a dias)."""
    return [int(n) for n in re.findall(r"\b(\d{1,2})\b", token)]


def _dia_valido(n: int) -> bool:
    return 1 <= n <= 31


# Rotulos de tabla que NO son el tramite ("Hasta 1 2 3 4", "Ultimo digito del NIT"...).
_RUIDO_RE = re.compile(
    r"^(hasta|d[ií]gito|n[úu]mero|nit|[úu]ltimo|total|d[ií]as?|por|grupo|rango)\b",
    re.IGNORECASE,
)


def _es_ruido(line: str) -> bool:
    """Descarta lineas que en realidad son cabeceras de la tabla de la DIAN."""
    if _RUIDO_RE.match(line):
        return True
    digitos = sum(ch.isdigit() for ch in line)
    return digitos > max(3, 0.25 * len(line))


# Cola de ruido que el parser antiguo dejaba pegada: "Hasta 1 2 3 4", "Ultimo digito del NIT"...
_RUIDO_COLA_RE = re.compile(
    r"(?:\s*\b(?:hasta|d[ií]gito|n[úu]mero|nit|[úu]ltimo|total|d[ií]as?|por)\b[\s\d,\.]*)+$",
    re.IGNORECASE,
)
_MESES_NOMBRES = (
    "enero", "febrero", "marzo", "abril", "mayo", "junio",
    "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
)
_MESES_ABBR = ("ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic")
_MESES_ALT = "|".join(_MESES_NOMBRES + _MESES_ABBR)

# "Hasta" seguido de un digito, un rango ("67-68") o un mes introduce SIEMPRE la
# cabecera/periodo de la tabla de la DIAN, nunca continua un tramite legitimo.
# Asi se corta tambien el caso en que el parser concatenaba varios meses seguidos.
_HASTA_RUIDO_RE = re.compile(
    rf"\s+\bhasta\b\s*(?:(?:al|a)\s+)?(?:{_MESES_ALT}\b|\d)",
    re.IGNORECASE,
)


def sanitizar_obligacion(text: str) -> str:
    """Limpia el ruido que el parser dejo en la obligacion ya almacenada.

    1. Corta en el primer "Hasta" que introduce ruido de tabla (mes o rango de
       digitos), deshaciendo la concatenacion de varios meses que el parser
       antiguo producia.
    2. Elimina la cola de digitos restante ("... Hasta 1 2 3 4").
    3. Quita el rotulo de mes inicial ("Marzo Declaracion y pago mensual" ->
       "Declaracion y pago mensual").
    """
    s = re.sub(r"\s+", " ", (text or "")).strip()

    corte = _HASTA_RUIDO_RE.search(s)
    if corte:
        s = s[: corte.start()].strip()

    s = _RUIDO_COLA_RE.sub("", s).strip(" .,-\u2013")

    partes = s.split(" ", 1)
    if len(partes) == 2:
        mes = partes[0].lower().rstrip(".")
        resto = partes[1].strip()
        # Solo se quita el mes si queda un rotulo razonable detras.
        if (mes in _MESES_NOMBRES or mes in _MESES_ABBR) and len(resto) >= 10:
            s = resto

    return re.sub(r"\s+", " ", s).strip()


def limpiar_obligaciones(db: Session) -> int:
    """Aplica `sanitizar_obligacion` a los eventos ya almacenados (una sola vez).

    Devuelve cuántas filas resultaron modificadas. Idempotente.
    """
    cambiadas = 0
    for row in db.scalars(select(TaxCalendar)).all():
        limpio = sanitizar_obligacion(row.obligation)
        if limpio and limpio != row.obligation:
            row.obligation = limpio[:255]
            cambiadas += 1
    db.commit()
    return cambiadas


def _armar_evento(event_date: date, obligation: str, context: str) -> dict:
    obligation = re.sub(r"\s+", " ", obligation).strip(" .,-–")[:255]
    return {
        "event_date": event_date,
        "obligation": obligation or f"Vencimiento {event_date.strftime('%d/%m/%Y')}",
        "description": re.sub(r"\s+", " ", context).strip()[:2000] or None,
        "category": _deducir_categoria(obligation, context),
    }


def _parse_tabla_dian(lines: list[str], year: int) -> list[dict]:
    """
    Estrategia principal: el layout de la DIAN.
    Busca un rotulo de mes y luego la fila de digitos del NIT seguida de la fila de dias.

    Arrastra el rotulo de seccion mas cercano por encima (p. ej. "Renta Grandes
    contribuyentes") para poder deducir la categoria correcta.
    """
    events: list[dict] = []
    header_re = re.compile(r"d[ií]gito", re.IGNORECASE)
    seccion = ""  # ultimo rotulo de seccion visto (categoria)

    for idx, line in enumerate(lines):
        # Un rotulo de seccion es texto no numerico que identifica una categoria
        # y no es ni un mes ni el encabezado del NIT.
        if _deducir_categoria(line) != "General" and not _mes_de(line.split()[0] if line.split() else "") \
                and not header_re.search(line):
            seccion = line

        match = re.match(
            r"^(?:hasta\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ]{4,12})(?:\s+(\d{4}))?$",
            line, re.IGNORECASE,
        )
        if not match:
            continue
        mes = _mes_de(match.group(1))
        if not mes:
            continue
        anio = int(match.group(2)) if match.group(2) else year
        if not 2000 <= anio <= 2100:
            anio = year

        # Contexto: lineas no numericas entre el mes y el encabezado del NIT.
        # Se descarta el ruido de la propia tabla ("Hasta 1 2 3 4", "Ultimo digito"...)
        # y se corta si aparece otro rotulo de mes, para no desbordar el tramite
        # hacia el bloque siguiente (p. ej. "Marzo" colandose en el de enero).
        tramite_parts: list[str] = []
        j = idx + 1
        while j < len(lines) and j - idx <= 8:
            nxt = lines[j]
            if header_re.search(nxt):
                break
            nxt_match = re.match(
                r"^(?:hasta\s+)?([A-Za-zÁÉÍÓÚáéíóúñÑ]{4,12})(?:\s+(\d{4}))?$",
                nxt, re.IGNORECASE,
            )
            if nxt_match and _mes_de(nxt_match.group(1)):
                break  # comienza el siguiente mes: no es parte de este tramite
            if not re.fullmatch(r"[\d\s\-/\.]+", nxt) and not _es_ruido(nxt):
                tramite_parts.append(nxt)
            j += 1

        # Ventana siguiente: fila de digitos del NIT (1..9,0) y fila de dias.
        # La fila de digitos NO son dias (incluye el 0), por eso no se filtra por validez.
        k, filas_numericas = j, []
        while k < len(lines) and k - idx <= 14:
            nums = _enteros(lines[k])
            if len(nums) >= 5:
                filas_numericas.append(nums)
                if len(filas_numericas) == 2:
                    break
            k += 1

        if len(filas_numericas) < 2:
            continue

        days_row = [n for n in filas_numericas[1] if _dia_valido(n)]
        if not days_row:
            continue

        tramite = " ".join(tramite_parts).strip()
        context = " — ".join(p for p in (seccion, line, tramite) if p)
        for n in days_row:
            try:
                events.append(_armar_evento(date(anio, mes, n), tramite or "Vencimiento", context))
            except ValueError:
                continue  # dia inexistente en el mes (p. ej. 31 de abril)
    return events


def _parse_fechas_explicitas(lines: list[str], year: int) -> list[dict]:
    """
    Estrategia secundaria: fechas escritas en texto.
    Soporta "15 de febrero de 2026", "15/02/2026", "15-02-26" y "2026-02-15".
    """
    events: list[dict] = []
    mes_alt = "|".join(sorted(_MESES_LARGO, key=len, reverse=True))
    re_larga = re.compile(
        rf"\b(\d{{1,2}})\s+de\s+({mes_alt})(?:\s+de\s+(\d{{4}}))?\b", re.IGNORECASE
    )
    re_barras = re.compile(r"\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b")
    re_iso = re.compile(r"\b(\d{4})-(\d{2})-(\d{2})\b")
    seccion = ""

    for line in lines:
        obligation = re_larga.sub("", line)
        obligation = re_barras.sub("", obligation)
        obligation = re_iso.sub("", obligation)
        obligation = obligation.strip(" .,-–:")

        found: list[date] = []
        for m in re_larga.finditer(line):
            d, mes_txt, anio_txt = m.groups()
            anio = int(anio_txt) if anio_txt else year
            try:
                found.append(date(anio, _mes_de(mes_txt), int(d)))
            except ValueError:
                continue
        for m in re_barras.finditer(line):
            d, mo, a = m.groups()
            anio = int(a) + 2000 if len(a) == 2 else int(a)
            try:
                found.append(date(anio, int(mo), int(d)))
            except ValueError:
                continue
        for m in re_iso.finditer(line):
            a, mo, d = m.groups()
            try:
                found.append(date(int(a), int(mo), int(d)))
            except ValueError:
                continue

        for dt in found:
            if not 2000 <= dt.year <= 2100:
                continue
            if not obligation or _NO_OBLIGACION.match(obligation):
                obligation = f"Vencimiento {dt.strftime('%d/%m/%Y')}"
            context = " — ".join(p for p in (seccion, line) if p)
            events.append(_armar_evento(dt, obligation, context))
        # Arrastra el rotulo de seccion si esta linea no contiene fecha.
        if not found and _deducir_categoria(line) != "General":
            seccion = line
    return events


def parse_tax_pdf_text(text: str, year: int = 2026) -> list[dict]:
    """
    Extrae eventos del texto del Calendario Tributario.

    Combina dos estrategias y elimina duplicados:
      1. Layout tabular de la DIAN (fila de dias por ultimo digito del NIT).
      2. Fechas explicitas escritas en el texto.
    """
    lines = _lineas(text)
    if not lines:
        return []

    events = _parse_tabla_dian(lines, year)
    events.extend(_parse_fechas_explicitas(lines, year))

    seen: set[tuple[date, str]] = set()
    unique: list[dict] = []
    for ev in sorted(events, key=lambda e: (e["event_date"], e["obligation"])):
        key = (ev["event_date"], ev["obligation"].lower())
        if key in seen:
            continue
        seen.add(key)
        unique.append(ev)
    return unique


def import_calendar_from_pdf(
    db: Session, text: str, year: int = 2026, source: str = "import"
) -> dict:
    """
    Procesa el texto extraido del PDF y lo guarda en la base de datos, taggeado
    por anio (`TaxCalendar.year`) y por archivo de origen (`TaxCalendar.source`).

    Es idempotente: no duplica eventos con la misma fecha y obligacion.
    El `year` guardado es el del PROPIO evento, de modo que un calendario 2026
    con vencimientos de enero 2027 queda correctamente repartido por anios.
    """
    parsed_data = parse_tax_pdf_text(text, year)
    existentes = {
        (e.year, e.event_date, (e.obligation or "").strip().lower())
        for e in db.scalars(select(TaxCalendar)).all()
    }

    created = 0
    years: dict[int, int] = {}
    for item in parsed_data:
        item["year"] = item["event_date"].year
        item["source"] = source
        key = (item["year"], item["event_date"], item["obligation"].strip().lower())
        if key in existentes:
            continue
        db.add(TaxCalendar(**item))
        existentes.add(key)
        years[item["year"]] = years.get(item["year"], 0) + 1
        created += 1
    db.commit()

    return {
        "total": len(parsed_data),
        "created": created,
        "duplicates": len(parsed_data) - created,
        "dates": sorted({e["event_date"].isoformat() for e in parsed_data}),
        "years": {str(y): n for y, n in sorted(years.items())},
    }


def get_calendar_events(db: Session, year: int | None = None):
    """
    Retorna los eventos ordenados por fecha, opcionalmente filtrados por anio.
    """
    stmt = select(TaxCalendar)
    if year is not None:
        stmt = stmt.where(TaxCalendar.year == year)
    return db.scalars(stmt.order_by(TaxCalendar.event_date.asc())).all()


def get_calendar_years(db: Session) -> list[dict]:
    """Años disponibles en la BD con su conteo de eventos y el ultimo origen."""
    rows = db.execute(
        select(TaxCalendar.year, TaxCalendar.source, func.count(TaxCalendar.id))
        .group_by(TaxCalendar.year, TaxCalendar.source)
        .order_by(TaxCalendar.year)
    ).all()
    by_year: dict[int, dict] = {}
    for anio, source, count in rows:
        slot = by_year.setdefault(anio, {"year": anio, "events": 0, "sources": set()})
        slot["events"] += count
        if source:
            slot["sources"].add(source)
    return [
        {"year": v["year"], "events": v["events"], "sources": sorted(v["sources"])}
        for v in by_year.values()
    ]


def delete_calendar_year(db: Session, year: int) -> int:
    """Elimina todos los eventos importados de un anio. Devuelve filas borradas."""
    stmt = delete(TaxCalendar).where(TaxCalendar.year == year)
    count = db.execute(stmt).rowcount or 0
    db.commit()
    return count


# ---------------------------------------------------------------------------
# Exportacion iCal (.ics) para Windows Calendar / Outlook / Google Calendar
# ---------------------------------------------------------------------------

_MESES = {
    "ene": 1, "enero": 1, "feb": 2, "mar": 3, "abr": 4, "may": 5, "jun": 6,
    "jul": 7, "ago": 8, "sep": 9, "oct": 10, "nov": 11, "dic": 12,
}
_DIGITOS = [str(d) for d in range(1, 10)] + ["0"]  # 1..9, 0

# Espejo compacto de frontend/src/data/tributary2026.js (Calendario DIAN 2026).
# filas: ("rango", mes, tramite, dias) | ("unico", mes, tramite, dia)
#        | ("periodos", rotulo, [(periodo, mes_corto, dia), ...])
#        | ("grupos", mes, tramite, grupos, dias)
_CAL2026 = [
    ("Renta", "Grandes contribuyentes", [
        ("rango", "Febrero", "Pago 1a. cuota", ["10","11","12","13","16","17","18","19","20","23"]),
        ("rango", "Abril", "Declaración y pago 2a. cuota", ["13","14","15","16","20","21","22","23","24","27"]),
        ("rango", "Junio", "Pago 3a. cuota", ["10","11","12","16","17","18","19","22","23","24"]),
    ]),
    ("Renta", "Personas jurídicas", [
        ("rango", "Mayo", "Declaración y pago 1a. cuota", ["12","13","14","15","19","20","21","22","25","26"]),
        ("rango", "Julio", "Pago 2a. cuota", ["9","10","14","15","16","17","21","22","23","24"]),
    ]),
    ("Renta", "Personas naturales", [
        ("rango", "Agosto", "Declaración y pago · dígitos 01 al 26", ["12","13","14","18","19","20","21","24","25","26"]),
        ("rango", "Septiembre", "Declaración y pago · dígitos 27 al 66", ["1","2","3","4","7","8","9","10","11","14"]),
        ("rango", "Octubre", "Declaración y pago · dígitos 67 al 00", ["1","2","5","6","7","8","9","13","14","15"]),
    ]),
    ("IVA", "Bimestral", [
        ("rango", "Mayo", "Enero - febrero", ["12","13","14","15","19","20","21","22","25","26"]),
        ("rango", "Julio", "Marzo - abril", ["9","10","14","15","16","17","21","22","23","24"]),
        ("rango", "Septiembre", "Mayo - junio", ["9","10","11","14","15","16","17","18","21","22"]),
        ("rango", "Noviembre", "Julio - agosto", ["11","12","13","17","18","19","20","23","24","25"]),
    ]),
    ("Retención", "En la fuente · mensual", [
        ("rango", "Febrero", "Periodo enero", ["10","11","12","13","16","17","18","19","20","23"]),
        ("rango", "Marzo", "Periodo febrero", ["10","11","12","13","16","17","18","19","20","24"]),
        ("rango", "Abril", "Periodo marzo", ["13","14","15","16","20","21","22","23","24","27"]),
    ]),
    ("Presencia Económica Significativa", "PES", [
        ("periodos", "Pagos anticipados bimestrales", [("ene - feb","mar","13"), ("mar - abr","may","15"), ("may - jun","jul","15"), ("jul - ago","sep","14"), ("sep - oct","nov","17"), ("nov - dic","ene 2027","18")]),
        ("unico", "Abril", "Declaración anual", "23"),
    ]),
    ("Activos en el exterior", "Activos en el exterior", [
        ("nota", "Declaración anual", "Las fechas son las mismas de renta grandes contribuyentes, personas jurídicas, personas naturales y RST."),
    ]),
    ("Consumo", "Consumo", [
        ("nota", "Declaración y pago bimestral", "En las mismas fechas que el impuesto sobre las ventas bimestral (incluyendo bolsas plásticas y cannabis)."),
    ]),
    ("Gasolina y ACPM", "Gasolina y ACPM", [
        ("periodos", "Declaración mensual y pago", [("enero","feb","13"), ("febrero","mar","13"), ("marzo","abr","16"), ("abril","may","15"), ("mayo","jun","16"), ("junio","jul","15"), ("julio","ago","18"), ("agosto","sep","14"), ("septiembre","oct","15"), ("octubre","nov","17"), ("noviembre","dic","15"), ("diciembre","ene 2027","18")]),
    ]),
    ("Carbono", "Carbono", [
        ("periodos", "Declaración y pago", [("ene - feb","mar","13"), ("mar - abr","may","15"), ("may - jun","jul","15"), ("jul - ago","sep","14"), ("sep - oct","nov","17"), ("nov - dic","ene 2027","18")]),
    ]),
    ("RST", "RST", [
        ("grupos", "Abril", "Declaración anual y pago · Consolidada", ["1-2","3-4","5-6","7-8","9-0"], ["20","21","22","23","24"]),
        ("grupos", "Febrero", "Consolidada de IVA", ["1-2","3-4","5-6","7-8","9-0"], ["16","17","18","19","20"]),
    ]),
    ("RST - Anticipo bimestral", "RST - Anticipo bimestral", [
        ("rango", "Mayo", "Enero - febrero", ["12","13","14","15","19","20","21","22","25","26"]),
        ("rango", "Junio", "Marzo - abril", ["10","11","12","16","17","18","19","22","23","24"]),
        ("rango", "Julio", "Mayo - junio", ["9","10","14","15","16","17","21","22","23","24"]),
        ("rango", "Septiembre", "Julio - agosto", ["9","10","11","14","15","16","17","18","21","22"]),
        ("rango", "Noviembre", "Septiembre - octubre", ["11","12","13","17","18","19","20","23","24","25"]),
        ("rango", "Enero 2027", "Noviembre - diciembre", ["13","14","15","18","19","20","21","22","25","26"]),
    ]),
    ("Precios de transferencia", "Precios de transferencia", [
        ("rango", "Septiembre", "Declaración informativa", ["9","10","11","14","15","16","17","18","21","22"]),
        ("rango", "Septiembre", "Documentación comprobatoria local y maestro", ["9","10","11","14","15","16","17","18","21","22"]),
        ("unico", "Diciembre", "Informe país por país", "15"),
    ]),
    ("IVA prestadores de servicios desde el exterior", "IVA prestadores de servicios desde el exterior", [
        ("periodos", "Declaración y pago bimestral", [("ene - feb","mar","13"), ("mar - abr","may","15"), ("may - jun","jul","15"), ("jul - ago","sep","14"), ("sep - oct","nov","17"), ("nov - dic","ene 2027","18")]),
    ]),
    ("Patrimonio", "Patrimonio", [
        ("rango", "Mayo", "Declaración y pago 1a. cuota", ["12","13","14","15","19","20","21","22","25","26"]),
        ("unico", "Septiembre", "Pago 2a. cuota", "14"),
    ]),
    ("Productos plásticos de un solo uso", "Productos plásticos de un solo uso", [
        ("unico", "Febrero", "Presentación y pago", "13"),
    ]),
    ("Bebidas ultraprocesadas y comestibles", "Bebidas ultraprocesadas y comestibles", [
        ("periodos", "Presentación y pago", [("ene - feb","mar","13"), ("mar - abr","may","15"), ("may - jun","jul","15"), ("jul - ago","sep","14"), ("sep - oct","nov","17"), ("nov - dic","ene 2027","18")]),
    ]),
    ("Registro Único de Beneficiarios Finales (RUB)", "RUB", [
        ("periodos", "Actualización · Independiente NIT", [("","feb","2"), ("","may","4"), ("","ago","3"), ("","nov","3")]),
    ]),
]


def _mes_anio(rotulo: str, year: int) -> tuple[int, int]:
    """'Febrero' -> (2, year); 'ene 2027' -> (1, 2027)."""
    partes = str(rotulo).strip().lower().split()
    mes = _MESES.get(partes[0][:3], 0)
    anio = year
    if len(partes) > 1 and partes[-1].isdigit():
        anio = int(partes[-1])
    return mes, anio


def _titulo(grupo: str, etiqueta: str, tramite: str) -> str:
    base = f"{grupo} · {etiqueta}" if grupo and grupo != etiqueta else etiqueta
    return f"DIAN {base} — {tramite}" if tramite else f"DIAN {base}"


def default_calendar_events(year: int = 2026) -> list[dict]:
    """Convierte la data base del calendario DIAN en eventos de todo el día."""
    events: list[dict] = []
    for grupo, etiqueta, filas in _CAL2026:
        for fila in filas:
            kind = fila[0]
            if kind == "rango":
                _, mes_txt, tramite, dias = fila
                mes, anio = _mes_anio(mes_txt, year)
                if not mes or not dias:
                    continue
                nums = sorted(int(d) for d in dias)
                events.append({
                    "start": date(anio, mes, nums[0]),
                    "end": date(anio, mes, nums[-1]) + timedelta(days=1),
                    "summary": _titulo(grupo, etiqueta, tramite),
                    "description": "Vencimiento por último dígito del NIT: "
                                   + ", ".join(f"{d}:{n}" for d, n in zip(_DIGITOS, dias)),
                    "category": "DIAN 2026",
                })
            elif kind == "unico":
                _, mes_txt, tramite, dia = fila
                mes, anio = _mes_anio(mes_txt, year)
                if not mes:
                    continue
                d = date(anio, mes, int(dia))
                events.append({
                    "start": d, "end": d + timedelta(days=1),
                    "summary": _titulo(grupo, etiqueta, tramite),
                    "description": "Independientemente del Número de Identificación Tributaria (NIT).",
                    "category": "DIAN 2026",
                })
            elif kind == "periodos":
                _, mes_txt, periodos = fila
                for periodo, m, dia in periodos:
                    mes, anio = _mes_anio(m, year)
                    if not mes:
                        continue
                    d = date(anio, mes, int(dia))
                    rot = f" {periodo}" if periodo else ""
                    events.append({
                        "start": d, "end": d + timedelta(days=1),
                        "summary": _titulo(grupo, etiqueta, f"Periodo{rot}"),
                        "description": f"{mes_txt} — vence hasta el {d.strftime('%d/%m/%Y')}.",
                        "category": "DIAN 2026",
                    })
            elif kind == "grupos":
                _, mes_txt, tramite, grupos, dias = fila
                mes, anio = _mes_anio(mes_txt, year)
                if not mes:
                    continue
                nums = sorted(int(d) for d in dias)
                events.append({
                    "start": date(anio, mes, nums[0]),
                    "end": date(anio, mes, nums[-1]) + timedelta(days=1),
                    "summary": _titulo(grupo, etiqueta, tramite),
                    "description": "Vencimiento por rangos del último dígito del NIT: "
                                   + ", ".join(f"{g}:{d}" for g, d in zip(grupos, dias)),
                    "category": "DIAN 2026",
                })
    return sorted(events, key=lambda e: e["start"])


def _ics_escape(text: str) -> str:
    return (
        str(text).replace("\\", "\\\\").replace(";", "\\;").replace(",", "\\,")
        .replace("\r\n", "\n").replace("\n", "\\n")
    )


def _ics_fold(line: str) -> str:
    """Doblado RFC 5545: lineas de maximo 75 octetos."""
    out, buf = [], ""
    for ch in line:
        if len((buf + ch).encode("utf-8")) > 74:
            out.append(buf)
            buf = " " + ch
        else:
            buf += ch
    out.append(buf)
    return "\r\n".join(out)


def build_ics(events: list[dict], calendar_name: str = "Cytech · Calendario Tributario 2026") -> str:
    """Serializa eventos de todo el día a un archivo iCal (RFC 5545)."""
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//Cytech//Calendario Tributario 2026//ES",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        f"X-WR-CALNAME:{_ics_escape(calendar_name)}",
        "X-WR-TIMEZONE:America/Bogota",
    ]
    for i, e in enumerate(events, 1):
        lines += [
            "BEGIN:VEVENT",
            f"UID:cytech-dian-{i}-{e['start'].isoformat()}@cytech",
            f"DTSTAMP:{stamp}",
            f"DTSTART;VALUE=DATE:{e['start'].strftime('%Y%m%d')}",
            f"DTEND;VALUE=DATE:{e['end'].strftime('%Y%m%d')}",
            _ics_fold(f"SUMMARY:{_ics_escape(e['summary'])}"),
            _ics_fold(f"DESCRIPTION:{_ics_escape(e['description'])}"),
            f"CATEGORIES:{_ics_escape(e.get('category', 'DIAN'))}",
            "TRANSP:TRANSPARENT",
            "STATUS:CONFIRMED",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(lines) + "\r\n"


def get_ics_events(db: Session, year: int = 2026) -> list[dict]:
    """Eventos importados en BD (si existen) + calendario base DIAN del año.

    Filtra por la columna `year` de la BD (almacenamiento por anio).
    """
    events = default_calendar_events(year)
    stored = get_calendar_events(db, year)
    for e in stored:
        events.append({
            "start": e.event_date,
            "end": e.event_date + timedelta(days=1),
            "summary": f"DIAN {e.obligation}",
            "description": e.category or "",
            "category": e.category or "Importado",
        })
    return sorted(events, key=lambda e: e["start"])
