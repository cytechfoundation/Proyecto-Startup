"""Calendario Tributario: parseo real de PDF, importación idempotente y exportación iCal."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from datetime import date
import re

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.tax_calendar import router as tax_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.tax_calendar import TaxCalendar
from app.services import tax_service
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(tax_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _admin_h():
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email="t@cytech.com", name="T", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


# --------------------------------------------------------------------------
# Helper: genera un PDF real (1 pagina, texto Helvetica) con xref calculado.
# --------------------------------------------------------------------------
def make_pdf(text_lines: list[str]) -> bytes:
    content = "BT /F1 12 Tf 50 750 Td 16 TL\n"
    for line in text_lines:
        safe = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
        content += f"({safe}) Tj T*\n"
    content += "ET"

    objs = [
        "<< /Type /Catalog /Pages 2 0 R >>",
        "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
        "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
        "/Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
        f"<< /Length {len(content)} >>\nstream\n{content}\nendstream",
        "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    ]

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")

    xref_pos = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode()
    out += b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (
        f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\n"
        f"startxref\n{xref_pos}\n%%EOF"
    ).encode()
    return bytes(out)


# Texto que imita el layout real de la DIAN (mes + tramite + fila de digitos + fila de dias).
DIAN_LINES = [
    "DIAN Calendario Tributario 2026",
    "Renta Grandes contribuyentes",
    "Febrero",
    "Pago 1a. cuota",
    "Último dígito del NIT",
    "1 2 3 4 5 6 7 8 9 0",
    "10 11 12 13 16 17 18 19 20 23",
    "IVA bimestral declaracion y pago",
    "Declaración y pago 15 de febrero de 2026",
]


# --------------------------------------------------------------------------
# Parser puro
# --------------------------------------------------------------------------
def test_parser_layout_dian():
    evs = tax_service.parse_tax_pdf_text("\n".join(DIAN_LINES), year=2026)
    dias = sorted(e["event_date"].day for e in evs if e["event_date"].month == 2)
    # Los 10 dias de la fila del NIT deben estar presentes.
    assert set([10, 11, 12, 13, 16, 17, 18, 19, 20, 23]) <= set(dias)
    assert all(e["event_date"].year == 2026 for e in evs)
    # El tramite "Pago 1a. cuota" debe acompañar a esos vencimientos.
    assert any("Pago 1a. cuota" in e["obligation"] for e in evs)


def test_parser_categorias():
    evs = tax_service.parse_tax_pdf_text("\n".join(DIAN_LINES), year=2026)
    categorias = {e["category"] for e in evs}
    assert "Renta" in categorias
    assert "IVA" in categorias


def test_parser_fechas_explicitas():
    txt = "Retención en la fuente vence el 20 de marzo de 2026. Pago 30/04/2026. Otro 2026-05-15 fin."
    evs = tax_service.parse_tax_pdf_text(txt, year=2026)
    fechas = sorted(e["event_date"] for e in evs)
    assert date(2026, 3, 20) in fechas
    assert date(2026, 4, 30) in fechas
    assert date(2026, 5, 15) in fechas
    assert any("Retención" in e["obligation"] for e in evs)


def test_parser_sin_eventos():
    assert tax_service.parse_tax_pdf_text("texto sin fechas ni obligaciones") == []


def test_parser_dedupe():
    txt = "Declaración y pago 15 de febrero de 2026\nDeclaración y pago 15 de febrero de 2026"
    evs = tax_service.parse_tax_pdf_text(txt, year=2026)
    assert len(evs) == 1


def test_parser_dia_invalido_omitido():
    # 31 de abril no existe: no debe romper ni generar evento.
    txt = "Impuesto al Carbono 31 de abril de 2026"
    evs = tax_service.parse_tax_pdf_text(txt, year=2026)
    assert all(e["event_date"].month != 4 for e in evs)


def test_parser_no_deja_ruido_de_columna():
    """La fila "Hasta 1 2 3 4" no debe colarse en la obligación."""
    txt = "\n".join([
        "Renta Grandes contribuyentes",
        "Febrero",
        "Declaración y pago mensual",
        "Hasta 1 2 3 4",              # cabecera de tabla, NO trámite
        "Último dígito del NIT",
        "1 2 3 4 5 6 7 8 9 0",        # fila de dígitos del NIT
        "Hasta 10 11 12 13 16 17",    # fila de días
    ])
    evs = tax_service.parse_tax_pdf_text(txt, year=2026)
    assert evs, "debe parsear los días del layout"
    assert {e["event_date"].day for e in evs} == {10, 11, 12, 13, 16, 17}
    for e in evs:
        assert "Hasta" not in e["obligation"]
        assert not re.search(r"Hasta\s+\d", e["obligation"])
        assert "Declaración y pago mensual" in e["obligation"]


def test_parser_no_desborda_el_tramite_al_mes_siguiente():
    """El trámite de un mes no debe arrastrar el rótulo del mes siguiente."""
    txt = "\n".join([
        "Renta",
        "Enero",
        "Declaración y pago mensual",
        "Último dígito del NIT",
        "1 2 3 4 5 6 7 8 9 0",
        "Hasta 13 14 15 16 17",
        "Febrero",
        "Pago 1a. cuota",
        "Último dígito del NIT",
        "1 2 3 4 5 6 7 8 9 0",
        "Hasta 10 11 12 13 16",
    ])
    evs = tax_service.parse_tax_pdf_text(txt, year=2026)
    enero = [e for e in evs if e["event_date"].month == 1]
    febrero = [e for e in evs if e["event_date"].month == 2]
    assert enero and febrero
    # Cada mes conserva su propio trámite, sin mezclarse.
    assert all("Febrero" not in e["obligation"] for e in enero)
    assert all("Enero" not in e["obligation"] for e in febrero)
    assert any("Declaración y pago mensual" in e["obligation"] for e in enero)
    assert any("Pago 1a. cuota" in e["obligation"] for e in febrero)


# --------------------------------------------------------------------------
# Saneado de obligaciones ya almacenadas
# --------------------------------------------------------------------------
def test_sanitizar_quita_cola_de_dias():
    assert tax_service.sanitizar_obligacion("Declaración y pago mensual Hasta 1 2 3 4") == "Declaración y pago mensual"


def test_sanitizar_quita_rotulo_de_mes_inicial():
    assert tax_service.sanitizar_obligacion("Marzo Declaración y pago mensual") == "Declaración y pago mensual"


def test_sanitizar_corta_varios_meses_concatenados():
    """Casos reales: el parser antiguo concatenaba bloques de meses consecutivos."""
    casos = [
        ("Declaración y pago mensual Hasta mayo Julio Declaración y pago mensual Hasta junio Agosto Declaración y pago mensual",
         "Declaración y pago mensual"),
        ("Declaración y pago Hasta 67-68 69-70 71-72 73-74",
         "Declaración y pago"),
        ("Declaración y pago Hasta julio - agosto Noviembre Declaración y pago Hasta septiembre - octubre Enero 2027 Declaración y pago",
         "Declaración y pago"),
        ("Declaración y pago Hasta 27-28 29-30 31-32 33-34",
         "Declaración y pago"),
    ]
    for sucio, esperado in casos:
        assert tax_service.sanitizar_obligacion(sucio) == esperado, sucio


def test_sanitizar_no_rompe_un_hasta_legitimo():
    """Un "hasta" que no introduce ruido de tabla debe conservarse."""
    legitima = "Recibo de pago hasta el cierre del periodo fiscal"
    assert tax_service.sanitizar_obligacion(legitima) == legitima


def test_sanitizar_conserva_lo_legitimo():
    # No debe tocar una obligación que ya está limpia ni una que empieza por
    # otro término, aunque contenga dígitos.
    limpia = "Declaración y pago mensual"
    assert tax_service.sanitizar_obligacion(limpia) == limpia
    assert tax_service.sanitizar_obligacion("Renta 2026 grandes contribuyentes") == "Renta 2026 grandes contribuyentes"


def test_sanitizar_es_idempotente():
    sucio = "Marzo Declaración y pago mensual Hasta 1 2 3 4"
    una = tax_service.sanitizar_obligacion(sucio)
    assert tax_service.sanitizar_obligacion(una) == una


def test_limpiar_obligaciones_en_bd():
    _limpiar()
    db = TestingSession()
    db.add(TaxCalendar(
        event_date=date(2026, 3, 13), year=2026, category="Retención en la fuente",
        obligation="Marzo Declaración y pago mensual Hasta 1 2 3 4",
    ))
    db.add(TaxCalendar(
        event_date=date(2026, 4, 20), year=2026, category="IVA",
        obligation="Declaración y pago bimestral",
    ))
    db.commit()

    assert tax_service.limpiar_obligaciones(db) == 1
    obligaciones = sorted(o for (o,) in db.query(TaxCalendar.obligation).all())
    db.close()
    assert "Declaración y pago mensual" in obligaciones
    assert "Declaración y pago bimestral" in obligaciones
    assert not any("Hasta" in o for o in obligaciones)


# --------------------------------------------------------------------------
# Extracción real desde PDF
# --------------------------------------------------------------------------
def test_extract_pdf_text_real():
    pdf = make_pdf(DIAN_LINES)
    text = tax_service.extract_pdf_text(pdf)
    assert "Febrero" in text
    assert "Pago 1a. cuota" in text


def test_extract_pdf_rechaza_no_pdf():
    import pytest
    with pytest.raises(tax_service.PDFReadError):
        tax_service.extract_pdf_text(b"esto no es un pdf")


def test_extract_pdf_rechaza_vacio():
    import pytest
    with pytest.raises(tax_service.PDFReadError):
        tax_service.extract_pdf_text(b"")


def test_end_to_end_pdf_a_eventos():
    evs = tax_service.parse_tax_pdf_text(tax_service.extract_pdf_text(make_pdf(DIAN_LINES)), 2026)
    assert len(evs) >= 10
    assert any(e["event_date"] == date(2026, 2, 10) for e in evs)


# --------------------------------------------------------------------------
# Endpoint /import
# --------------------------------------------------------------------------
def _limpiar():
    db = TestingSession()
    db.query(TaxCalendar).delete()
    db.commit()
    db.close()


def test_import_solo_admin():
    _limpiar()
    r = client.post("/api/v1/tax-calendar/import", files={"file": ("c.pdf", b"%PDF-1.4 x", "application/pdf")})
    assert r.status_code in (401, 403)


def test_import_pdf_real():
    _limpiar()
    pdf = make_pdf(DIAN_LINES)
    r = client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("Calendario_Tributario_2026.pdf", pdf, "application/pdf")},
        headers=_admin_h(),
    )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["created"] >= 10
    assert body["duplicates"] == 0
    assert body["first_date"] <= body["last_date"]


def test_import_es_idempotente():
    _limpiar()
    pdf = make_pdf(DIAN_LINES)
    h = _admin_h()
    first = client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("c.pdf", pdf, "application/pdf")},
        headers=h,
    ).json()
    second = client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("c.pdf", pdf, "application/pdf")},
        headers=h,
    ).json()
    assert second["created"] == 0
    assert second["duplicates"] == first["created"]


def test_import_rechaza_archivo_no_pdf():
    r = client.post(
        "/api/v1/tax-calendar/import",
        files={"file": ("notas.txt", b"hola mundo", "text/plain")},
        headers=_admin_h(),
    )
    assert r.status_code == 422


def test_import_pdf_sin_fechas():
    r = client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("vacio.pdf", make_pdf(["Sin fechas aqui", "Solo texto"]), "application/pdf")},
        headers=_admin_h(),
    )
    assert r.status_code == 422


# --------------------------------------------------------------------------
# /events y /ics
# --------------------------------------------------------------------------
def test_events_serializa_importados():
    _limpiar()
    pdf = make_pdf(DIAN_LINES)
    client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("c.pdf", pdf, "application/pdf")},
        headers=_admin_h(),
    )
    r = client.get("/api/v1/tax-calendar/events")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 10
    assert {"id", "event_date", "obligation", "description", "category"} <= set(data[0].keys())


def test_ics_incluye_importados():
    _limpiar()
    pdf = make_pdf(DIAN_LINES)
    client.post(
        "/api/v1/tax-calendar/import?year=2026",
        files={"file": ("c.pdf", pdf, "application/pdf")},
        headers=_admin_h(),
    )
    r = client.get("/api/v1/tax-calendar/ics?year=2026")
    assert r.status_code == 200
    assert r.headers["content-type"].startswith("text/calendar")
    body = r.text
    assert body.startswith("BEGIN:VCALENDAR") and body.rstrip().endswith("END:VCALENDAR")
    # Base DIAN 2026 (70) + importados.
    assert body.count("BEGIN:VEVENT") > 70


# --------------------------------------------------------------------------
# Almacenamiento por año: columnas year/source, filtro, /years y DELETE
# --------------------------------------------------------------------------
def _importar(nombre: str, lines: list[str], anio: int = 2026) -> dict:
    r = client.post(
        f"/api/v1/tax-calendar/import?year={anio}",
        files={"file": (nombre, make_pdf(lines), "application/pdf")},
        headers=_admin_h(),
    )
    assert r.status_code == 201, r.text
    return r.json()


def _filas_year(anio: int) -> list[TaxCalendar]:
    db = TestingSession()
    rows = db.query(TaxCalendar).filter(TaxCalendar.year == anio).all()
    db.close()
    return rows


def test_import_guarda_year_y_source():
    _limpiar()
    _importar("Calendario_Tributario_2026.pdf", DIAN_LINES, 2026)
    rows = _filas_year(2026)
    assert rows, "debe haber eventos almacenados en 2026"
    assert all(r.year == 2026 for r in rows)
    assert all(r.source == "Calendario_Tributario_2026.pdf" for r in rows)


def test_import_reparte_eventos_segun_su_fecha():
    """Un calendario 2026 con vencimientos de 2027 debe repartirse por años."""
    _limpiar()
    lines = [
        "DIAN Calendario Tributario 2026",
        "Renta",
        "Declaracion y pago 15 de febrero de 2026",
        "Retencion en la fuente 20 de enero de 2027",
    ]
    body = _importar("mixto.pdf", lines, 2026)
    assert body["years"].get("2026") == 1
    assert body["years"].get("2027") == 1
    assert _filas_year(2026) and _filas_year(2027)


def test_events_filtra_por_year():
    _limpiar()
    _importar("a2026.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2026"], 2026)
    _importar("a2027.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2027"], 2027)

    solo2026 = client.get("/api/v1/tax-calendar/events?year=2026").json()
    solo2027 = client.get("/api/v1/tax-calendar/events?year=2027").json()
    todos = client.get("/api/v1/tax-calendar/events").json()

    assert solo2026 and all(e["year"] == 2026 for e in solo2026)
    assert solo2027 and all(e["year"] == 2027 for e in solo2027)
    assert len(todos) == len(solo2026) + len(solo2027)


def test_events_devuelve_year_y_source():
    _limpiar()
    _importar("mi_cal.pdf", DIAN_LINES, 2026)
    data = client.get("/api/v1/tax-calendar/events?year=2026").json()
    assert {"year", "source"} <= set(data[0].keys())
    assert data[0]["source"] == "mi_cal.pdf"


def test_years_agrupa_por_anio_con_fuente():
    _limpiar()
    _importar("c2026.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2026"], 2026)
    _importar("c2027.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2027"], 2027)

    data = client.get("/api/v1/tax-calendar/years").json()
    anios = {d["year"]: d for d in data}
    assert set(anios) == {2026, 2027}
    assert anios[2026]["events"] == 1
    assert anios[2026]["sources"] == ["c2026.pdf"]
    assert anios[2027]["sources"] == ["c2027.pdf"]


def test_delete_year_solo_afecta_ese_anio():
    _limpiar()
    _importar("c2026.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2026"], 2026)
    _importar("c2027.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2027"], 2027)

    r = client.delete("/api/v1/tax-calendar/events?year=2026", headers=_admin_h())
    assert r.status_code == 200, r.text
    assert r.json()["deleted"] == 1
    assert not _filas_year(2026)
    assert _filas_year(2027), "el otro año no debe tocarse"


def test_delete_year_requiere_admin():
    _limpiar()
    _importar("c2026.pdf", ["Renta", "Declaracion y pago 15 de febrero de 2026"], 2026)
    r = client.delete("/api/v1/tax-calendar/events?year=2026")
    assert r.status_code in (401, 403)


def test_delete_year_inexistente_404():
    _limpiar()
    r = client.delete("/api/v1/tax-calendar/events?year=2031", headers=_admin_h())
    assert r.status_code == 404


def test_ics_filtra_por_columna_year():
    """El ICS de 2026 no debe arrastrar importados de 2027."""
    _limpiar()
    _importar("mixto.pdf", [
        "Renta",
        "Declaracion y pago 15 de febrero de 2026",
        "Declaracion y pago 15 de febrero de 2027",
    ], 2026)

    ics2026 = client.get("/api/v1/tax-calendar/ics?year=2026").text
    ics2027 = client.get("/api/v1/tax-calendar/ics?year=2027").text
    # El base 2026 no incluye fechas de 2027, pero el importado de 2026 sí.
    assert "20260215" in ics2026
    assert "DTSTART;VALUE=DATE:20270215" not in ics2026
    assert "DTSTART;VALUE=DATE:20270215" in ics2027
