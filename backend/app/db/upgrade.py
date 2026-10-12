"""Migracion ligera de esquema y datos sin Alembic.

`Base.metadata.create_all()` solo crea tablas nuevas: NUNCA anade columnas a
tablas que ya existen. Como `tax_calendar` ya tiene datos reales, aqui se
aplican los ALTERs que falten, se rellenan los valores historicos y se corrige
el ruido que el parser antiguo dejaba en `obligation`.
"""
from sqlalchemy import inspect, select, text
from sqlalchemy.orm import Session

from app.models.tax_calendar import TaxCalendar
from app.services.tax_service import sanitizar_obligacion

# Columnas nuevas y su DDL por tipo (valido en SQLite y PostgreSQL).
_NUEVAS_COLUMNAS: tuple[tuple[str, str], ...] = (
    ("year", "INTEGER"),
    ("source", "VARCHAR(255)"),
)

# Columnas nuevas de `users` (registro local con contraseña).
_NUEVAS_COLUMNAS_USERS: tuple[tuple[str, str], ...] = (
    ("password_hash", "VARCHAR(255)"),
)


def upgrade_tax_calendar(engine) -> dict:
    """Aplica los ALTERs pendientes sobre `tax_calendar` y corrige los datos.

    Devuelve un resumen para poder registrarlo en el log de arranque.
    Idempotente: en un arranque limpio no toca nada.
    """
    inspector = inspect(engine)
    if "tax_calendar" not in inspector.get_table_names():
        return {"aplicadas": [], "backfill": 0, "obligaciones_limpias": 0}

    existentes = {col["name"] for col in inspector.get_columns("tax_calendar")}
    aplicadas: list[str] = []

    with engine.begin() as conn:
        for nombre, ddl in _NUEVAS_COLUMNAS:
            if nombre in existentes:
                continue
            conn.execute(text(f"ALTER TABLE tax_calendar ADD COLUMN {nombre} {ddl}"))
            aplicadas.append(nombre)
        # Indice de consulta por anio (IF NOT EXISTS es portable en ambos motores).
        conn.execute(text(
            "CREATE INDEX IF NOT EXISTS ix_tax_calendar_year ON tax_calendar (year)"
        ))

    backfill = 0
    limpias = 0
    with Session(engine) as db:
        if aplicadas:
            # Rellena `year` en las filas historicas a partir de la fecha.
            for row in db.scalars(
                select(TaxCalendar).where(TaxCalendar.year.is_(None))
            ).all():
                if row.event_date:
                    row.year = row.event_date.year
                    backfill += 1
            db.commit()

        # Migracion de datos: el parser antiguo dejaba "… Hasta 1 2 3 4" y el
        # rotulo del mes siguiente dentro de `obligation`. Es idempotente.
        for row in db.scalars(select(TaxCalendar)).all():
            limpio = sanitizar_obligacion(row.obligation)
            if limpio and limpio != row.obligation:
                row.obligation = limpio[:255]
                limpias += 1
        db.commit()

    return {"aplicadas": aplicadas, "backfill": backfill, "obligaciones_limpias": limpias}


def upgrade_users(engine) -> dict:
    """Aplica los ALTERs pendientes sobre `users` (registro local con contraseña).

    Idempotente: si la tabla ya tiene la columna, no toca nada.
    """
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return {"aplicadas": []}

    existentes = {col["name"] for col in inspector.get_columns("users")}
    aplicadas: list[str] = []
    with engine.begin() as conn:
        for nombre, ddl in _NUEVAS_COLUMNAS_USERS:
            if nombre in existentes:
                continue
            conn.execute(text(f"ALTER TABLE users ADD COLUMN {nombre} {ddl}"))
            aplicadas.append(nombre)
    return {"aplicadas": aplicadas}
