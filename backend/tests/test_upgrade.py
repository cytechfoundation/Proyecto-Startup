"""Migracion ligera `app.db.upgrade`: ALTERs de tax_calendar + saneado de datos."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, inspect, text
from sqlalchemy.pool import StaticPool

from app.db.base import Base
from app.db.upgrade import upgrade_tax_calendar
from app.models.tax_calendar import TaxCalendar

VIEJO = (
    "CREATE TABLE tax_calendar ("
    " id INTEGER PRIMARY KEY,"
    " event_date DATE NOT NULL,"
    " obligation VARCHAR(255) NOT NULL,"
    " description TEXT,"
    " category VARCHAR(100),"
    " created_at DATETIME NOT NULL)"
)

# Obligacion con el ruido que el parser antiguo dejaba: rotulo de mes inicial y
# la fila "Hasta 1 2 3 4" de la tabla de la DIAN.
SUCIA = "Marzo Declaraci\u00f3n y pago mensual Hasta 1 2 3 4"
LIMPIA = "Declaraci\u00f3n y pago mensual"


def _motor_con_tabla_vieja():
    """BD en memoria con el ESQUEMA ANTIGUO (sin year/source) y datos ruidosos."""
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    with engine.begin() as conn:
        conn.execute(text(VIEJO))
        conn.execute(text(
            "INSERT INTO tax_calendar (event_date, obligation, category, created_at) VALUES "
            f"('2026-03-13', '{SUCIA}', 'Retenci\u00f3n', '2026-01-01'),"
            "('2027-01-20', 'Declaraci\u00f3n y pago bimestral', 'IVA', '2026-01-01')"
        ))
    return engine


def test_upgrade_anade_columnas_y_rellena_year():
    engine = _motor_con_tabla_vieja()
    cols = {c["name"] for c in inspect(engine).get_columns("tax_calendar")}
    assert "year" not in cols and "source" not in cols

    resumen = upgrade_tax_calendar(engine)

    assert set(resumen["aplicadas"]) == {"year", "source"}
    assert resumen["backfill"] == 2
    assert {"year", "source"} <= {c["name"] for c in inspect(engine).get_columns("tax_calendar")}

    with engine.connect() as conn:
        anios = sorted(r[0] for r in conn.execute(text("SELECT year FROM tax_calendar")))
    assert anios == [2026, 2027]


def test_upgrade_sanea_obligaciones_ruidosas():
    engine = _motor_con_tabla_vieja()
    resumen = upgrade_tax_calendar(engine)

    with engine.connect() as conn:
        obligaciones = sorted(r[0] for r in conn.execute(text("SELECT obligation FROM tax_calendar")))

    assert obligaciones == ["Declaración y pago bimestral", LIMPIA]
    assert not any("Hasta" in o for o in obligaciones)
    assert resumen["obligaciones_limpias"] == 1


def test_upgrade_es_idempotente():
    engine = _motor_con_tabla_vieja()
    upgrade_tax_calendar(engine)
    segunda = upgrade_tax_calendar(engine)

    assert segunda["aplicadas"] == []
    assert segunda["backfill"] == 0
    assert segunda["obligaciones_limpias"] == 0


def test_upgrade_con_modelo_al_dia_no_rompe():
    """Si la tabla ya esta al dia (create_all), el upgrade no toca nada."""
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    with engine.begin() as conn:
        conn.execute(text(
            "INSERT INTO tax_calendar (event_date, year, obligation, category, created_at) "
            "VALUES ('2026-05-15', 2026, 'IVA bimestral', 'IVA', '2026-01-01')"
        ))

    resumen = upgrade_tax_calendar(engine)

    assert resumen["aplicadas"] == []
    assert resumen["obligaciones_limpias"] == 0
    with engine.connect() as conn:
        row = conn.execute(text("SELECT year, obligation FROM tax_calendar")).fetchone()
    assert row == (2026, "IVA bimestral")


def test_upgrade_sin_tabla_devuelve_vacio():
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    assert upgrade_tax_calendar(engine) == {
        "aplicadas": [], "backfill": 0, "obligaciones_limpias": 0,
    }


def test_modelo_declara_year_y_source():
    """El modelo real si declara year/source (para create_all en BDs nuevas)."""
    engine = create_engine(
        "sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False}
    )
    Base.metadata.create_all(bind=engine)
    assert {"year", "source"} <= {c["name"] for c in inspect(engine).get_columns("tax_calendar")}
    assert TaxCalendar.__table__.c.year is not None
    assert TaxCalendar.__table__.c.source is not None
