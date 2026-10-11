"""Intérprete AVS/CVV: tablas, rechazos y enriquecimiento de capturas."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.payments import router as payments_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services import card_errors
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(payments_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _h():
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email="card@cytech.com", name="C", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


def test_interpret_rechazo():
    r = card_errors.interpret("N", "N", "visa")
    assert r["rejected"] is True and "rechazada" in r["avs"]["meaning"].lower()


def test_interpret_maestro():
    r = card_errors.interpret("0", "0", "maestro")
    assert r["rejected"] is False and "coincide" in r["avs"]["meaning"].lower()


def test_interpret_endpoint_publico():
    r = client.post("/api/v1/payments/card-errors/interpret", json={"brand": "visa", "avs_code": "Z", "cvv_code": "M"})
    assert r.status_code == 200 and r.json()["rejected"] is False


def test_capture_enriquecida_con_decline_info():
    from app.core import config as _cfg
    snap = (_cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret)
    _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = "X", "Y"

    class FakeResp:
        status_code = 200

        def __init__(self, data):
            self._data = data

        def json(self):
            return self._data

        def raise_for_status(self):
            pass

    def fake_request(method, url, **kw):
        return FakeResp({"id": "C-1", "status": "DECLINED",
                         "processor_response": {"avs_code": "N", "cvv_code": "N"}})

    def fake_post(url, **kw):
        return FakeResp({"access_token": "T"})

    try:
        with patch.object(httpx, "request", side_effect=fake_request), patch.object(httpx, "post", side_effect=fake_post):
            r = client.get("/api/v1/payments/captures/C-1", headers=_h())
            assert r.status_code == 200
            assert r.json()["decline_info"]["rejected"] is True
    finally:
        _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = snap
