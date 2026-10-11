"""Donaciones con Google Pay: montos fijos, causas válidas y captura restringida al libro."""
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
from app.db.base import Base
from app.db.session import get_db

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


class FakeResp:
    status_code = 200

    def __init__(self, data):
        self._data = data

    def json(self):
        return self._data

    def raise_for_status(self):
        pass


def _mocked(order=None, capture=None):
    def fake_request(method, url, **kw):
        if url.endswith("/v2/checkout/orders") and method == "POST":
            return FakeResp({"id": "DON-1", "status": "CREATED", "links": []})
        if "/capture" in url:
            return FakeResp({"id": "DON-1", "status": "COMPLETED"})
        return FakeResp({})

    def fake_post(url, **kw):
        return FakeResp({"access_token": "T"})

    return patch.object(httpx, "request", side_effect=fake_request), patch.object(httpx, "post", side_effect=fake_post)


def test_donate_rechaza_monto_y_causa():
    assert client.post("/api/v1/payments/donate/orders", json={"amount_usd": 7, "cause": "becas"}).status_code == 400
    assert client.post("/api/v1/payments/donate/orders", json={"amount_usd": 5, "cause": "otra"}).status_code == 400


def test_donate_flujo_completo():
    # sin credenciales reales: el servicio exige config; mockeamos PayPal
    from app.core import config as _cfg
    snap = (_cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret)
    _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = "X", "Y"
    p1, p2 = _mocked()
    try:
        with p1, p2:
            o = client.post("/api/v1/payments/donate/orders", json={"amount_usd": 5, "cause": "becas"})
            assert o.status_code == 200 and o.json()["id"] == "DON-1"
            c = client.post("/api/v1/payments/donate/orders/DON-1/capture")
            assert c.status_code == 200 and c.json()["status"] == "COMPLETED"
    finally:
        _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = snap


def test_donate_capture_orden_desconocida_403():
    assert client.post("/api/v1/payments/donate/orders/NOPE/capture").status_code == 403
