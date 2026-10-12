"""Libro transaccional: permisos por tipo, listado propio/admin y webhooks."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.transactions import router as tx_router
from app.api.v1.endpoints.webhooks import router as wh_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user_integration import UserIntegration
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(tx_router, prefix="/api/v1")
app.include_router(wh_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _h(email: str, role: str):
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email=email, name=email, provider="google"))
    user.role = role
    db.commit()
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


ADMIN = _h("txadmin@cytech.com", "admin")
EDITOR = _h("txeditor@mail.com", "editor")
CLIENT = _h("txclient@mail.com", "client")


def test_invoice_editor_ok_client_forbidden():
    assert client.post("/api/v1/transactions",
                       json={"provider": "dian", "kind": "invoice", "amount": 1250000},
                       headers=EDITOR).status_code == 201
    assert client.post("/api/v1/transactions",
                       json={"provider": "dian", "kind": "invoice", "amount": 100},
                       headers=CLIENT).status_code == 403


def test_payment_solo_admin():
    assert client.post("/api/v1/transactions",
                       json={"provider": "paypal", "kind": "payment", "amount": 50000},
                       headers=ADMIN).status_code == 201
    assert client.post("/api/v1/transactions",
                       json={"provider": "paypal", "kind": "payment", "amount": 50000},
                       headers=EDITOR).status_code == 403


def test_listado_propio_vs_admin_y_paginacion():
    me = client.get("/api/v1/transactions", headers=EDITOR).json()
    assert me["total"] >= 1 and all(True for _ in me["items"])
    all_tx = client.get("/api/v1/transactions", params={"all": "true"}, headers=ADMIN).json()
    assert all_tx["total"] >= me["total"]
    p = client.get("/api/v1/transactions", params={"page": 1, "page_size": 1}, headers=ADMIN).json()
    assert len(p["items"]) == 1 and p["pages"] >= 1


def test_webhook_ingest():
    r = client.post("/api/v1/webhooks/paypal", json={"id": "WH-1", "amount_cents": 25000})
    assert r.status_code == 200 and r.json()["received"] is True
    assert client.post("/api/v1/webhooks/nose", json={}).status_code == 404
    assert client.post("/api/v1/webhooks/dian", json="no-json",
                       headers={"Content-Type": "application/json"}).status_code == 400


def test_webhook_capture_completed_normaliza():
    r = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-EV-1", "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {"id": "PAY-1234567890ABCDEF", "status": "COMPLETED",
                     "amount": {"currency": "USD", "value": "15.00"}},
    })
    assert r.status_code == 200
    admin = _h("whcheck@cytech.com", "admin")
    rows = client.get("/api/v1/transactions", params={"all": "true"}, headers=admin).json()
    match = [t for t in rows["items"] if t["external_id"] == "PAY-1234567890ABCDEF"]
    assert match and match[0]["amount"] == 1500 and match[0]["status"] == "unverified"


def test_webhook_duplicado_idempotente():
    evt = {"id": "WH-DUP-1", "event_type": "PAYMENT.CAPTURE.COMPLETED",
           "resource": {"id": "C-DUP", "status": "COMPLETED",
                        "amount": {"currency": "USD", "value": "5.00"}}}
    r1 = client.post("/api/v1/webhooks/paypal", json=evt)
    r2 = client.post("/api/v1/webhooks/paypal", json=evt)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json().get("duplicate") is True
    admin = _h("whdup@cytech.com", "admin")
    rows = client.get("/api/v1/transactions", params={"all": "true"}, headers=admin).json()
    assert len([t for t in rows["items"] if t["event_id"] == "WH-DUP-1"]) == 1


def test_webhooks_info():
    r = client.get("/api/v1/webhooks")
    assert r.status_code == 200 and "paypal" in str(r.json()["listeners"])


def _seed(**kw) -> str:
    db = TestingSession()
    row = Transaction(**kw)
    db.add(row)
    db.commit()
    rid = row.id
    db.close()
    return rid


def test_webhook_concilia_pago_por_orden_relacionado():
    _seed(provider="paypal", kind="payment", amount=0, currency="USD",
          status="pending", external_id="ORDER-77")
    r = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-CAP-77", "event_type": "PAYMENT.CAPTURE.COMPLETED",
        "resource": {"id": "CAP-77", "status": "COMPLETED",
                     "amount": {"currency": "USD", "value": "25.00"},
                     "supplementary_data": {"related_ids": {"order_id": "ORDER-77"}}}})
    assert r.status_code == 200
    assert r.json()["reconciled"] == {"actualizadas": 1, "creadas": 0}
    db = TestingSession()
    row = db.scalar(select(Transaction).where(Transaction.external_id == "ORDER-77"))
    assert row.status == "completed" and row.amount == 2500 and row.currency == "USD"
    db.close()


def test_webhook_factura_pagada_concilia_pago():
    _seed(provider="paypal", kind="invoice", amount=15000, currency="USD",
          status="sent", external_id="INV2-900")
    r = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-INV-1", "event_type": "INVOICING.INVOICE.PAID",
        "resource": {"id": "INV2-900", "status": "PAID",
                     "amount": {"currency_code": "USD", "value": "150.00"}}})
    assert r.status_code == 200
    assert r.json()["reconciled"] == {"actualizadas": 1, "creadas": 1}
    db = TestingSession()
    inv = db.scalar(select(Transaction).where(
        Transaction.external_id == "INV2-900", Transaction.kind == "invoice"))
    pay = db.scalar(select(Transaction).where(
        Transaction.external_id == "INV2-900", Transaction.kind == "payment"))
    assert inv.status == "paid"
    assert pay is not None and pay.amount == 15000 and pay.status == "completed"
    db.close()
    # Reintento de PayPal (otro event_id, misma factura): no duplica el pago
    r2 = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-INV-2", "event_type": "INVOICING.INVOICE.PAID",
        "resource": {"id": "INV2-900", "status": "PAID",
                     "amount": {"currency_code": "USD", "value": "150.00"}}})
    assert r2.json()["reconciled"] == {"actualizadas": 0, "creadas": 0}
    db = TestingSession()
    pagos = db.scalars(select(Transaction).where(
        Transaction.external_id == "INV2-900", Transaction.kind == "payment")).all()
    assert len(pagos) == 1
    db.close()


def test_webhook_disputes_solo_alerta():
    r = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-DIS-1", "event_type": "CUSTOMER.DISPUTE.CREATED",
        "resource": {"id": "D-1", "status": "OPEN"}})
    assert r.status_code == 200
    assert r.json()["reconciled"] == {"actualizadas": 0, "creadas": 0}


def test_webhook_consent_revoked_desverifica_integracion():
    db = TestingSession()
    db.add(UserIntegration(user_id="u-wh-consent", provider="paypal", status="connected",
                           account="revoked@mail.com", verified=True))
    db.commit()
    db.close()
    r = client.post("/api/v1/webhooks/paypal", json={
        "id": "WH-CONS-1", "event_type": "IDENTITY.AUTHORIZATION-CONSENT.REVOKED",
        "resource": {"email": "revoked@mail.com"}})
    assert r.status_code == 200
    assert r.json()["reconciled"]["integraciones"] == 1
    db = TestingSession()
    row = db.scalar(select(UserIntegration).where(UserIntegration.account == "revoked@mail.com"))
    assert row.verified is False
    db.close()


def test_webhooks_info_catalogo_ampliado():
    evs = client.get("/api/v1/webhooks").json()["subscribed_events"]
    assert "INVOICING.INVOICE.PAID" in evs
    assert "CUSTOMER.DISPUTE.CREATED" in evs
    assert "PAYMENT.CAPTURE.REVERSED" in evs
    assert "IDENTITY.AUTHORIZATION-CONSENT.REVOKED" in evs
