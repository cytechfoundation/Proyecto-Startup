"""PayPal Invoicing: payload de creación, envío, seguimiento, RBAC y libro (mockeado)."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.invoicing import router as invoicing_router
from app.core import config
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.transaction import Transaction
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(invoicing_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)

CALLS: list = []

LIST = {
    "total_items": 2,
    "invoices": [
        {"id": "INV2-1", "invoice_number": "INV-1042", "status": "SENT",
         "amount": {"currency_code": "USD", "value": "150.00"},
         "primary_recipients": [{"email_address": "ana@retail.com"}]},
        {"id": "INV2-2", "invoice_number": "INV-1043", "status": "DRAFT",
         "amount": {"currency_code": "USD", "value": "80.00"},
         "primary_recipients": [{"email_address": "luis@otro.com"}]},
    ],
}

DETAILS = {
    "INV2-1": {"id": "INV2-1", "status": "SENT", "invoice_number": "INV-1042",
               "amount": {"currency_code": "USD", "value": "150.00"},
               "primary_recipients": [{"email_address": "ana@retail.com"}],
               "metadata": {"recipient_view_url": "https://www.paypal.com/invoicehosted/abc"}},
    "INV2-2": {"id": "INV2-2", "status": "DRAFT", "invoice_number": "INV-1043",
               "amount": {"currency_code": "USD", "value": "80.00"},
               "primary_recipients": [{"email_address": "luis@otro.com"}],
               "metadata": {"recipient_view_url": "https://www.paypal.com/invoicehosted/def"}},
}


class FakeResp:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self._data = data or {}

    def json(self):
        return self._data


def fake_post(url, **kw):
    return FakeResp(200, {"access_token": "T"})


def fake_request(method, url, **kw):
    CALLS.append((method, url, kw.get("json")))
    if url.endswith("/v2/invoicing/invoices") and method == "POST":
        return FakeResp(201, {"id": "INV2-1", "status": "DRAFT",
                              "amount": {"currency_code": "USD", "value": "150.00"}})
    if "/send" in url:
        return FakeResp(200, {"id": "INV2-1", "status": "SENT"})
    if "/reminders" in url:
        return FakeResp(200, {"reminded": True})
    if "/cancel" in url:
        return FakeResp(200, {"id": "INV2-1", "status": "CANCELLED"})
    if "/qr-code" in url:
        return FakeResp(200, {"image": "iVBORw0KGgo="})
    if "/payments" in url:
        return FakeResp(200, {"id": "PAY-1", "status": "MARKED_AS_PAID",
                              "amount": {"currency_code": "USD", "value": "150.00"}})
    if "invoices?page=" in url:
        return FakeResp(200, LIST)
    for inv_id, detail in DETAILS.items():
        if url.endswith(f"/v2/invoicing/invoices/{inv_id}"):
            return FakeResp(200, detail)
    return FakeResp(200, {})


@pytest.fixture(autouse=True)
def _mock_and_config():
    snap = (config.settings.paypal_client_id, config.settings.paypal_client_secret)
    config.settings.paypal_client_id, config.settings.paypal_client_secret = "test-id", "test-secret"
    CALLS.clear()
    with patch.object(httpx, "request", side_effect=fake_request), \
         patch.object(httpx, "post", side_effect=fake_post):
        yield
    config.settings.paypal_client_id, config.settings.paypal_client_secret = snap


def _headers(role: str, email: str) -> dict:
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email=email, name="Test", provider="google"))
    if user.role != role:
        user.role = role
        db.commit()
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


ADMIN = lambda: _headers("admin", "admin@inv.test")          # noqa: E731
EDITOR = lambda: _headers("editor", "editor@inv.test")       # noqa: E731
ANA = lambda: _headers("client", "ana@retail.com")           # noqa: E731 (destinataria)
CARLOS = lambda: _headers("client", "carlos@x.com")          # noqa: E731


def test_crear_factura_payload_y_libro():
    r = client.post("/api/v1/paypal/invoices", headers=ADMIN(), json={
        "email": "ana@retail.com", "customer_name": "Ana", "currency": "USD",
        "items": [{"name": "Consultoría", "quantity": 2, "unit_amount": "75.00",
                   "tax_percent": "19"}],
        "note": "Octubre", "send": True, "send_email": True,
    })
    assert r.status_code == 200
    body = r.json()
    assert body["invoice_id"] == "INV2-1" and body["send"]["status"] == "SENT"

    method, url, payload = next(c for c in CALLS if c[1].endswith("/v2/invoicing/invoices"))
    assert method == "POST"
    assert payload["primary_recipients"][0]["email_address"] == "ana@retail.com"
    assert payload["primary_recipients"][0]["name"]["given_name"] == "Ana"
    item = payload["items"][0]
    assert item["unit_amount"] == {"currency_code": "USD", "value": "75.00"}
    assert item["quantity"] == "2" and item["tax"] == {"percent": "19"}
    assert payload["note"] == "Octubre"

    db = TestingSession()
    row = db.scalar(select(Transaction).where(Transaction.kind == "invoice",
                                              Transaction.external_id == "INV2-1"))
    assert row is not None and row.amount == 15000 and row.provider == "paypal"
    db.close()


def test_crear_sin_enviar():
    r = client.post("/api/v1/paypal/invoices", headers=ADMIN(), json={
        "email": "ana@retail.com",
        "items": [{"name": "Seats", "unit_amount": "10.00"}],
        "send": False,
    })
    assert r.status_code == 200 and "send" not in r.json()
    assert not any("/send" in c[1] for c in CALLS)


def test_crear_validaciones():
    h = ADMIN()
    base = {"email": "ana@retail.com", "items": [{"name": "X", "unit_amount": "10.00"}]}
    assert client.post("/api/v1/paypal/invoices", headers=h, json={**base, "items": []}).status_code == 422
    assert client.post("/api/v1/paypal/invoices", headers=h, json={**base, "currency": "COP"}).status_code == 400
    bad = {**base, "items": [{"name": "X", "unit_amount": "0"}]}
    assert client.post("/api/v1/paypal/invoices", headers=h, json=bad).status_code == 400


def test_enviar_recordatorio_cancelar_qr():
    h = ADMIN()
    assert client.post("/api/v1/paypal/invoices/INV2-1/send", headers=h).json()["status"] == "SENT"
    assert client.post("/api/v1/paypal/invoices/INV2-1/reminders", headers=h).json()["reminded"] is True
    assert client.post("/api/v1/paypal/invoices/INV2-1/cancel", headers=h).json()["status"] == "CANCELLED"
    qr = client.get("/api/v1/paypal/invoices/INV2-1/qr-code", headers=h)
    assert qr.status_code == 200
    assert qr.json()["image"] == "iVBORw0KGgo="
    assert qr.json()["pay_url"].endswith("/invoicehosted/abc")


def test_pago_externo_concilia_libro():
    r = client.post("/api/v1/paypal/invoices/INV2-1/payments", headers=ADMIN(),
                    json={"amount": "150.00", "currency": "USD", "note": "Transferencia"})
    assert r.status_code == 200 and r.json()["status"] == "MARKED_AS_PAID"
    db = TestingSession()
    row = db.scalar(select(Transaction).where(Transaction.kind == "payment",
                                              Transaction.external_id == "PAY-1"))
    assert row is not None and row.amount == 15000 and row.status == "marked_as_paid"
    db.close()


def test_listado_filtrado_por_destinatario():
    admin = client.get("/api/v1/paypal/invoices", headers=ADMIN())
    assert admin.status_code == 200 and admin.json()["total_items"] == 2

    editor = client.get("/api/v1/paypal/invoices", headers=EDITOR())
    assert editor.status_code == 200 and len(editor.json()["invoices"]) == 2

    ana = client.get("/api/v1/paypal/invoices", headers=ANA())
    assert ana.status_code == 200
    assert [i["id"] for i in ana.json()["invoices"]] == ["INV2-1"]

    carlos = client.get("/api/v1/paypal/invoices", headers=CARLOS())
    assert carlos.status_code == 200 and carlos.json()["invoices"] == []


def test_detalle_permisos_y_pay_url():
    ok = client.get("/api/v1/paypal/invoices/INV2-1", headers=EDITOR())
    assert ok.status_code == 200
    assert ok.json()["pay_url"] == "https://www.paypal.com/invoicehosted/abc"

    owner = client.get("/api/v1/paypal/invoices/INV2-1", headers=ANA())
    assert owner.status_code == 200

    ajeno = client.get("/api/v1/paypal/invoices/INV2-1", headers=CARLOS())
    assert ajeno.status_code == 403


def test_rbac_acciones_solo_admin():
    payload = {"email": "ana@retail.com", "items": [{"name": "X", "unit_amount": "10.00"}]}
    assert client.post("/api/v1/paypal/invoices", headers=EDITOR(), json=payload).status_code == 403
    assert client.post("/api/v1/paypal/invoices", headers=ANA(), json=payload).status_code == 403
    assert client.post("/api/v1/paypal/invoices/INV2-1/send", headers=EDITOR()).status_code == 403
    assert client.post("/api/v1/paypal/invoices/INV2-1/reminders", headers=CARLOS()).status_code == 403
    assert client.post("/api/v1/paypal/invoices/INV2-1/payments", headers=EDITOR(),
                       json={"amount": "10.00"}).status_code == 403
    assert client.get("/api/v1/paypal/invoices").status_code == 401


def test_503_sin_credenciales():
    snap = (config.settings.paypal_client_id, config.settings.paypal_client_secret)
    config.settings.paypal_client_id = config.settings.paypal_client_secret = ""
    try:
        assert client.get("/api/v1/paypal/invoices", headers=ADMIN()).status_code == 503
    finally:
        config.settings.paypal_client_id, config.settings.paypal_client_secret = snap
