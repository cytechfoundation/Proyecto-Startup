"""Contadores de impacto: siembra pública y ajuste administrativo."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.impact import router as impact_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.impact_counter import ImpactCounter
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(impact_router, prefix="/api/v1")


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
    user, _ = get_or_create_user(db, FederatedIdentity(email="a@cytech.com", name="A", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


# ---------------------------------------------------------------- lectura
def test_get_publico_siembra_los_valores_de_la_landing():
    r = client.get("/api/v1/impact/counters")
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 3
    por_key = {c["key"]: c for c in body["counters"]}
    assert por_key["becas"]["value"] == 100 and por_key["becas"]["unit"] == "becas"
    assert por_key["equipos"]["value"] == 250
    assert por_key["talleres"]["value"] == 500
    assert por_key["becas"]["updated_at"]


def test_lecturas_repetidas_no_reinician_el_valor():
    h = _admin_h()
    client.put("/api/v1/impact/counters/becas", json={"value": 137}, headers=h)
    assert client.get("/api/v1/impact/counters/becas").json()["value"] == 137
    assert client.get("/api/v1/impact/counters").json()["counters"][0]["value"] == 137
    # la siembra es idempotente: no vuelve a los 100 por defecto
    assert client.get("/api/v1/impact/counters/becas").json()["value"] == 137


def test_clave_desconocida_devuelve_404():
    assert client.get("/api/v1/impact/counters/zarpa").status_code == 404
    h = _admin_h()
    assert client.put("/api/v1/impact/counters/zarpa", json={"value": 1}, headers=h).status_code == 404
    assert client.post("/api/v1/impact/counters/zarpa/adjust", json={"delta": 1}, headers=h).status_code == 404


# ---------------------------------------------------------------- escritura
def test_escritura_requiere_admin():
    assert client.put("/api/v1/impact/counters/becas", json={"value": 1}).status_code in (401, 403)
    assert client.post("/api/v1/impact/counters/becas/adjust", json={"delta": 1}).status_code in (401, 403)


def test_put_fija_el_valor_y_se_refleja_en_la_landing():
    h = _admin_h()
    r = client.put("/api/v1/impact/counters/becas", json={"value": 120}, headers=h)
    assert r.status_code == 200 and r.json()["value"] == 120
    publico = client.get("/api/v1/impact/counters/becas").json()
    assert publico["value"] == 120 and publico["label"] == "Becas de estudio"


def test_adjust_de_uno_en_uno():
    h = _admin_h()
    client.put("/api/v1/impact/counters/becas", json={"value": 100}, headers=h)
    assert client.post("/api/v1/impact/counters/becas/adjust", json={"delta": 1}, headers=h).json()["value"] == 101
    assert client.post("/api/v1/impact/counters/becas/adjust", json={"delta": 1}, headers=h).json()["value"] == 102
    assert client.post("/api/v1/impact/counters/becas/adjust", json={"delta": -5}, headers=h).json()["value"] == 97


def test_adjust_no_baja_de_cero():
    h = _admin_h()
    client.put("/api/v1/impact/counters/talleres", json={"value": 2}, headers=h)
    r = client.post("/api/v1/impact/counters/talleres/adjust", json={"delta": -999}, headers=h)
    assert r.json()["value"] == 0


def test_valores_fuera_de_rango_422():
    h = _admin_h()
    assert client.put("/api/v1/impact/counters/becas", json={"value": -1}, headers=h).status_code == 422
    assert client.put("/api/v1/impact/counters/becas", json={"value": "x"}, headers=h).status_code == 422
    assert client.post("/api/v1/impact/counters/becas/adjust", json={"delta": 99999}, headers=h).status_code == 422


def test_ajuste_persiste_en_la_base():
    h = _admin_h()
    client.put("/api/v1/impact/counters/equipos", json={"value": 250}, headers=h)
    client.post("/api/v1/impact/counters/equipos/adjust", json={"delta": 3}, headers=h)
    db = TestingSession()
    fila = db.get(ImpactCounter, "equipos")
    assert fila.value == 253, "el ajuste debe escribirse en la BD, no vivir en memoria"
    db.close()


def test_catalogo_es_cerrado():
    """El servicio solo acepta las claves documentadas (sin contadores arbitrarios)."""
    from app.services import impact_service
    from app.services.impact_service import UnknownCounter

    db = TestingSession()
    try:
        assert set(impact_service.DEFAULTS) == {"becas", "equipos", "talleres"}
        try:
            impact_service.get_counter(db, "inventado")
            raise AssertionError("debió rechazar una clave fuera del catálogo")
        except UnknownCounter:
            pass
    finally:
        db.close()
