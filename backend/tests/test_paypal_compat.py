"""Compat v6: createOrder retorna orden con id; validaciones anti-abuso."""
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

from app.api.v1.endpoints.paypal_compat import router as compat_router
from app.db.base import Base
from app.db.session import get_db

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(compat_router)


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


def _mocked():
    def fake_request(method, url, **kw):
        return FakeResp({"id": "V6-1", "status": "CREATED", "links": []})

    def fake_post(url, **kw):
        return FakeResp({"access_token": "T"})

    return patch.object(httpx, "request", side_effect=fake_request), patch.object(httpx, "post", side_effect=fake_post)


def test_compat_create_ok():
    from app.core import config as _cfg
    snap = (_cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret)
    _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = "X", "Y"
    p1, p2 = _mocked()
    try:
        with p1, p2:
            r = client.post("/paypal-api/checkout/orders/create", json={
                "intent": "CAPTURE",
                "purchase_units": [{"amount": {"currency_code": "USD", "value": "10.00"}}],
            })
            assert r.status_code == 201 and r.json()["id"] == "V6-1"
    finally:
        _cfg.settings.paypal_client_id, _cfg.settings.paypal_client_secret = snap


def test_compat_rechazos():
    bad_intent = client.post("/paypal-api/checkout/orders/create", json={
        "intent": "sale", "purchase_units": [{"amount": {"currency_code": "USD", "value": "10.00"}}]})
    assert bad_intent.status_code == 400
    bad_amount = client.post("/paypal-api/checkout/orders/create", json={
        "intent": "CAPTURE", "purchase_units": [{"amount": {"currency_code": "USD", "value": "7.00"}}]})
    assert bad_amount.status_code == 400
    bad_ccy = client.post("/paypal-api/checkout/orders/create", json={
        "intent": "CAPTURE", "purchase_units": [{"amount": {"currency_code": "COP", "value": "10.00"}}]})
    assert bad_ccy.status_code == 400
    multi = client.post("/paypal-api/checkout/orders/create", json={
        "intent": "CAPTURE", "purchase_units": [{}, {}]})
    assert multi.status_code in (400, 422)  # 422: cuerpo malformado (Pydantic)
