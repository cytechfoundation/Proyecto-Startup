"""Mis integraciones: vincular/desvincular proveedores por usuario."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.integrations import router as integrations_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(integrations_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _h(email: str = "integ@test.com"):
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email=email, name=email, provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='client')}"}


def test_lista_inicial_desconectada():
    r = client.get("/api/v1/integrations", headers=_h())
    assert r.status_code == 200
    assert all(not i["connected"] for i in r.json())


def test_paypal_exige_cuenta():
    h = _h("pp@test.com")
    assert client.post("/api/v1/integrations/paypal", json={}, headers=h).status_code == 400
    ok = client.post("/api/v1/integrations/paypal", json={"account": "ventas@negocio.com"}, headers=h)
    assert ok.status_code == 200 and ok.json()["account"] == "ventas@negocio.com"
    assert ok.json()["verified"] is False
    lst = client.get("/api/v1/integrations", headers=h).json()
    assert [i for i in lst if i["provider"] == "paypal"][0]["connected"] is True


def test_paypal_authorize_sin_credenciales_503():
    h = _h("noauth@test.com")
    assert client.get("/api/v1/integrations/paypal/authorize", headers=h).status_code == 503


def test_paypal_verify_flujo_mockeado():
    from unittest.mock import patch

    import httpx as _httpx

    from app.services import paypal_service as _pp

    _pp_helpers = {"client_id": "X", "secret": "Y"}
    old = (_pp.settings if hasattr(_pp, "settings") else None)
    from app.core import config as _cfg
    snap = (_cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret)
    _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = _pp_helpers["client_id"], _pp_helpers["secret"]

    class FakeResp:
        status_code = 200
        url = ""

        def json(self):
            if "userinfo" in FakeResp.url:
                return {"emails": [{"value": "dueño@paypal.com", "primary": True}]}
            return {"access_token": "U"}

        def raise_for_status(self):
            pass

    def fake_post(url, **kw):
        FakeResp.url = url
        return FakeResp()

    def fake_request(method, url, **kw):
        FakeResp.url = url
        return FakeResp()

    def fake_get(url, **kw):
        FakeResp.url = url
        return FakeResp()

    try:
        h = _h("verifyme@mail.com")
        with patch.object(_httpx, "request", side_effect=fake_request), patch.object(_httpx, "post", side_effect=fake_post), patch.object(_httpx, "get", side_effect=fake_get):
            authz = client.get("/api/v1/integrations/paypal/authorize", headers=h)
            assert authz.status_code == 200 and "authorize_url" in authz.json()
            # simula el callback de PayPal tras el login (state = user_id)
            me = client.get("/api/v1/auth/me", headers=h).json()
            cb = client.get("/api/v1/integrations/paypal/callback", params={"code": "C", "state": me["id"]})
            assert cb.status_code == 200
            lst = client.get("/api/v1/integrations", headers=h).json()
            pp = [i for i in lst if i["provider"] == "paypal"][0]
            assert pp["verified"] is True and pp["account"] == "dueño@paypal.com"
    finally:
        _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = snap


def test_pos_directa_y_desconectar():
    h = _h("pos@test.com")
    assert client.post("/api/v1/integrations/pos", json={}, headers=h).status_code == 200
    assert client.get("/api/v1/integrations", headers=h).status_code == 200
    assert client.delete("/api/v1/integrations/pos", headers=h).status_code == 204
    lst = client.get("/api/v1/integrations", headers=h).json()
    assert [i for i in lst if i["provider"] == "pos"][0]["connected"] is False


def test_proveedor_invalido():
    h = _h("bad@test.com")
    assert client.post("/api/v1/integrations/stripe", json={}, headers=h).status_code == 400


def test_all_solo_admin():
    assert client.get("/api/v1/integrations/all").status_code in (401, 403)
    db = TestingSession()
    admin, _ = get_or_create_user(db, FederatedIdentity(email="aud@cytech.com", name="A", provider="google"))
    uid = str(admin.id)
    db.close()
    h = {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}
    r = client.get("/api/v1/integrations/all", headers=h)
    assert r.status_code == 200 and isinstance(r.json(), list)


def test_paypal_config_no_expone_secret():
    r = client.get("/api/v1/integrations/paypal/config", headers=_h("cfg@test.com"))
    assert r.status_code == 200 and "secret" not in r.text.lower().replace("client_secret", "")
    assert set(r.json()) == {"provider", "mode", "client_id_configured"}
