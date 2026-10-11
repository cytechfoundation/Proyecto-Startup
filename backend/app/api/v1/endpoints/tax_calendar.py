"""Endpoints para la gestion del Calendario Tributario (organizado por anio)."""
from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Response, Query
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.user import User
from app.services import tax_service

router = APIRouter(prefix="/tax-calendar", tags=["tax-calendar"])


@router.post("/import", status_code=201)
async def import_pdf(
    file: UploadFile = File(...),
    year: int = Query(2026, ge=2020, le=2100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Importa el Calendario Tributario desde un archivo PDF (multipart/form-data).

    - Extrae el texto real del PDF con `pypdf` y lo parsea en eventos.
    - Detecta el layout tabular de la DIAN (fila de dias por ultimo digito del NIT)
      y tambien fechas escritas ("15 de febrero de 2026", "15/02/2026", "2026-02-15").
    - **Guarda por anio**: cada evento se almacena con su `year` (el del propio
      evento) y el `source` (nombre del archivo), de modo que los calendarios de
      anios distintos conviven sin mezclarse.
    - **Idempotente**: reimportar el mismo PDF no duplica eventos.
    - Solo accesible por administradores.
    """
    content = await file.read()

    try:
        text = tax_service.extract_pdf_text(content)
    except tax_service.PDFReadError as exc:
        raise HTTPException(422, str(exc))

    result = tax_service.import_calendar_from_pdf(
        db, text, year, source=file.filename or "import"
    )

    if result["total"] == 0:
        raise HTTPException(
            422,
            "El PDF se leyó pero no se reconocieron fechas u obligaciones. "
            "Verifique que sea un Calendario Tributario con texto (no un escaneo).",
        )

    return {
        "message": (
            f"Importación exitosa: {result['created']} eventos nuevos, "
            f"{result['duplicates']} duplicados omitidos."
        ),
        "filename": file.filename,
        "year": year,
        "count": result["created"],
        "created": result["created"],
        "duplicates": result["duplicates"],
        "total_parsed": result["total"],
        "first_date": result["dates"][0],
        "last_date": result["dates"][-1],
        "years": result["years"],
    }


@router.get("/events")
def list_events(
    year: int | None = Query(None, ge=2020, le=2100),
    category: str | None = Query(None),
    db: Session = Depends(get_db),
):
    """
    Obtiene los eventos importados, opcionalmente filtrados por anio y categoria.

    - `?year=2026` devuelve solo los eventos de 2026.
    - Sin parametros devuelve todos los anios almacenados.
    """
    events = tax_service.get_calendar_events(db, year)
    if category:
        events = [e for e in events if (e.category or "") == category]
    return [
        {
            "id": e.id,
            "event_date": e.event_date.isoformat(),
            "year": e.year or e.event_date.year,
            "obligation": e.obligation,
            "description": e.description,
            "category": e.category,
            "source": e.source,
        }
        for e in events
    ]


@router.get("/years")
def list_years(db: Session = Depends(get_db)):
    """
    Años disponibles en la base de datos con su conteo de eventos y el archivo
    de origen que los importó. Útil para poblAR selectores de año en la UI.
    """
    return tax_service.get_calendar_years(db)


@router.delete("/events", status_code=200)
def clear_year(
    year: int = Query(..., ge=2020, le=2100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """
    Elimina TODOS los eventos importados de un año concreto. Solo administradores.

    Útil para reimportar una versión corregida del PDF sin mezclar datos viejos.
    """
    deleted = tax_service.delete_calendar_year(db, year)
    if deleted == 0:
        raise HTTPException(404, f"No hay eventos importados para el año {year}.")
    return {"message": f"Se eliminaron {deleted} eventos del año {year}.", "year": year, "deleted": deleted}


@router.get("/ics")
def export_ics(year: int = Query(2026, ge=2020, le=2100), db: Session = Depends(get_db)):
    """
    Exporta el calendario tributario en formato iCal (.ics), compatible con
    Windows Calendar, Outlook y Google Calendar.

    - Devuelve el calendario base DIAN del año indicado + los eventos importados
      de ese mismo año (columna `year`).
    - **Suscripción**: configure la URL de este endpoint como calendario por internet.
    - **Descarga**: abra el archivo .ics para agregarlo una sola vez.
    """
    events = tax_service.get_ics_events(db, year)
    ics = tax_service.build_ics(events, f"Cytech · Calendario Tributario {year}")
    filename = f"cytech-calendario-tributario-{year}.ics"
    return Response(
        content=ics,
        media_type="text/calendar; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )
