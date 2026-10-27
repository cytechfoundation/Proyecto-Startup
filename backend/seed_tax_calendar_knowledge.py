"""Indexa el Calendario Tributario (PDF oficial DIAN) en la base de conocimiento RAG.

Motivación
----------
El chatbot responde las dudas de calendario con RAG (`rag_service.answer`), pero
la base de conocimiento solo tenía los docs corporativos de `seed_knowledge.py`:
ante una pregunta de IVA/retenciones el retrieval devolvía contexto sin fechas y
el LLM contestaba "no tengo información específica sobre el calendario tributario".

Este script extrae el texto del PDF con el mismo motor que usa
`POST /tax-calendar/import` (`tax_service.extract_pdf_text` +
`parse_tax_pdf_text`) y lo indexa como documentos limpios agrupados:

* `Calendario Tributario DIAN 2026 (general)`  -> panorama y cómo funciona.
* `Calendario Tributario DIAN 2026 · <impuesto>` -> vencimientos por impuesto.
* `Calendario Tributario DIAN 2026 · <mes>`      -> vencimientos por mes.

Uso
---
    python seed_tax_calendar_knowledge.py                    # busca el PDF
    python seed_tax_calendar_knowledge.py C:\\ruta\\Calendario_Tributario_2026.pdf
    python seed_tax_calendar_knowledge.py --dry-run          # solo imprime

Idempotente: re-ejecutar actualiza los documentos cuyo contenido cambió y los
re-embeddea si les falta el embedding (no duplica filas).
"""
import argparse
import re
import sys
from collections import defaultdict
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select  # noqa: E402

from app.db.base import Base  # noqa: E402
from app.db.session import SessionLocal, engine  # noqa: E402
from app.models.knowledge import KnowledgeDoc  # noqa: E402
from app.services import llm_service, rag_service, tax_service  # noqa: E402

SOURCE = "tax_calendar"
TITLE_ROOT = "Calendario Tributario DIAN"

MESES = {
    1: "enero", 2: "febrero", 3: "marzo", 4: "abril", 5: "mayo", 6: "junio",
    7: "julio", 8: "agosto", 9: "septiembre", 10: "octubre", 11: "noviembre", 12: "diciembre",
}

# Glues que deja el extractor del PDF (texto incrustado de la DIAN).
_LIGATURES = {"ﬁ": "fi", "ﬂ": "fl", "ﬀ": "ff", "ﬃ": "ffi", "ﬄ": "ffl"}


# ----------------------------------------------------------------- utilidades
def _norm(text: str) -> str:
    """Normaliza el texto crudo del PDF: ligaduras, palabras pegadas y espacios."""
    for a, b in _LIGATURES.items():
        text = text.replace(a, b)
    text = text.replace("Retenciónen", "Retención en")
    text = re.sub(r"\s+", " ", text).strip(" .,-–")
    return text


def _dias(dates: list[date]) -> str:
    """[10,11,12,13,16] -> '10, 11, 12, 13 y 16'."""
    nums = sorted(d.day for d in dates)
    if len(nums) == 1:
        return str(nums[0])
    if len(nums) == 2:
        return f"{nums[0]} y {nums[1]}"
    return f"{', '.join(str(n) for n in nums[:-1])} y {nums[-1]}"


def _linea(label: str, dates: list[date]) -> str:
    """Una línea de contenido legible: etiqueta + días del mes (todos en un mes)."""
    first = min(dates)
    return f"- {label}: {_dias(dates)} de {MESES[first.month]} de {first.year}"


def _por_mes(events: list[dict]) -> dict[tuple[int, int], list[dict]]:
    grupos: dict[tuple[int, int], list[dict]] = defaultdict(list)
    for e in events:
        grupos[(e["event_date"].year, e["event_date"].month)].append(e)
    return dict(sorted(grupos.items()))


def _agrupar_por_desc(events: list[dict]) -> list[tuple[str, list[date]]]:
    """Agrupa fechas que comparten descripción/obligación (mismo trámite y mes)."""
    grupos: dict[tuple[str, date], list[date]] = defaultdict(list)
    for e in events:
        label = _norm(e.get("description") or e.get("obligation") or "Vencimiento")
        clave = (label, date(e["event_date"].year, e["event_date"].month, 1))
        grupos[clave].append(e["event_date"])
    ordenados = sorted(grupos.items(), key=lambda kv: (kv[0][1], kv[0][0]))
    return [(label, fechas) for (label, _), fechas in ordenados]


# --------------------------------------------------------------- construcción
def build_docs(events: list[dict], year: int, pdf_name: str) -> list[tuple[str, str]]:
    """Devuelve [(title, content)] con el calendario listo para indexar."""
    docs: list[tuple[str, str]] = []
    por_categoria: dict[str, list[dict]] = defaultdict(list)
    for e in events:
        por_categoria[e.get("category") or "General"].append(e)

    fechas = [e["event_date"] for e in events]
    cobertura = (
        f"{MESES[min(fechas).month]} de {min(fechas).year} a "
        f"{MESES[max(fechas).month]} de {max(fechas).year}"
    )

    # 1) panorama general
    conteo = ", ".join(
        f"{cat} ({len(evs)})"
        for cat, evs in sorted(por_categoria.items(), key=lambda kv: -len(kv[1]))
    )
    general = (
        f"Calendario Tributario DIAN {year} de Colombia (fuente: {pdf_name}).\n"
        "Cómo funciona: cada vencimiento se asigna por el ÚLTIMO DÍGITO del NIT "
        "(1, 2, 3, ..., 9, 0); los días de cada rango corresponden a un dígito. "
        "Si el NIT termina en otro dígito, ese día no te aplica.\n"
        f"Total de vencimientos indexados: {len(events)} ({conteo}). "
        f"Cobertura: {cobertura}.\n"
        f"Consulta el detalle por impuesto en los documentos '{TITLE_ROOT} {year} · "
        f"<impuesto>' y por mes en '{TITLE_ROOT} {year} · <mes>'.\n"
        "Fechas, detalle día a día por dígito del NIT, descarga .ics y suscripción "
        "al calendario: /calendario-tributario.\n"
        "Las fechas corresponden al año en curso del calendario; verifica siempre "
        "en la DIAN (www.dian.gov.co)."
    )
    docs.append((f"{TITLE_ROOT} {year} (general)", general))

    # 2) por impuesto
    for cat, evs in sorted(por_categoria.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        lineas = [_linea(label, fechas) for label, fechas in _agrupar_por_desc(evs)]
        contenido = (
            f"Vencimientos de {cat} en el Calendario Tributario DIAN {year} (Colombia). "
            f"Fuente: {pdf_name}. Se asignan por último dígito del NIT "
            f"(cada día de la lista aplica a un tramo de dígitos).\n"
            + "\n".join(lineas)
            + f"\nDetalle por dígito y suscripción: /calendario-tributario"
        )
        docs.append((f"{TITLE_ROOT} {year} · {cat}", contenido))

    # 3) por mes
    for (anio, mes), evs in _por_mes(events).items():
        lineas = [_linea(label, fechas) for label, fechas in _agrupar_por_desc(evs)]
        contenido = (
            f"Obligaciones que vencen en {MESES[mes]} de {anio} — Calendario Tributario "
            f"DIAN {year} (Colombia). Fuente: {pdf_name}. Vencimientos por último dígito "
            f"del NIT.\n" + "\n".join(lineas)
            + "\nDetalle por dígito y suscripción: /calendario-tributario"
        )
        docs.append((f"{TITLE_ROOT} {year} · {MESES[mes]} de {anio}", contenido))

    return docs


def upsert(db, title: str, content: str) -> str:
    """Inserta o actualiza un doc de conocimiento. Devuelve created/updated/skipped."""
    row = db.scalar(select(KnowledgeDoc).where(KnowledgeDoc.title == title))
    if row is not None and row.content == content and row.embedding:
        return "skipped"
    if row is not None:
        db.delete(row)
        db.commit()
    try:
        rag_service.add_document(db, title, content, SOURCE)
    except Exception as exc:  # sin red/key: guardamos sin embedding (retry en rerun)
        emb = None
        db.add(KnowledgeDoc(title=title, content=content, source=SOURCE, embedding=emb))
        db.commit()
        print(f"  ! '{title}' indexado SIN embedding ({exc}) -> vuelve a ejecutar para reintentar")
        return "created (sin embedding)"
    return "updated" if row is not None else "created"


# ----------------------------------------------------------------------- main
def _buscar_pdf(explicito: str | None) -> Path:
    candidatos = [Path(explicito)] if explicito else [
        Path(__file__).resolve().parent / "data" / "Calendario_Tributario_2026.pdf",
        Path.home() / "Downloads" / "Calendario_Tributario_2026.pdf",
    ]
    for c in candidatos:
        if c and c.is_file():
            return c
    raise SystemExit(
        "No encontré el PDF. Pásalo como argumento:\n"
        "  python seed_tax_calendar_knowledge.py C:\\ruta\\Calendario_Tributario_2026.pdf"
    )


def main() -> int:
    ap = argparse.ArgumentParser(description="Indexa el Calendario Tributario (PDF DIAN) en el RAG.")
    ap.add_argument("pdf", nargs="?", help="Ruta al PDF del Calendario Tributario.")
    ap.add_argument("--year", type=int, default=2026, help="Año del calendario (default 2026).")
    ap.add_argument("--dry-run", action="store_true", help="Solo imprime lo que indexaría.")
    args = ap.parse_args()

    pdf = _buscar_pdf(args.pdf)
    text = tax_service.extract_pdf_text(pdf.read_bytes())
    events = tax_service.parse_tax_pdf_text(text, args.year)
    if not events:
        raise SystemExit(f"El PDF se leyó ({len(text)} caracteres) pero no se reconocieron fechas.")

    docs = build_docs(events, args.year, pdf.name)
    print(f"PDF       : {pdf}")
    print(f"eventos   : {len(events)}  |  documentos a indexar: {len(docs)}")
    print(f"embedding : {'sí (' + str(llm_service.configured()).lower() + ')' if llm_service.configured() else 'NO (modo keywords)'}")

    if args.dry_run:
        for title, content in docs:
            print(f"\n=== {title} ({len(content)} chars) ===\n{content[:600]}")
        return 0

    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        stats = defaultdict(int)
        for title, content in docs:
            accion = upsert(db, title, content)
            stats[accion] += 1
            print(f"  [{accion}] {title}")
    finally:
        db.close()

    print(f"\nListo -> creados={stats['created']} actualizados={stats['updated']} "
          f"sin_cambios={stats['skipped']} otros={sum(v for k, v in stats.items() if k not in ('created', 'updated', 'skipped'))}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
