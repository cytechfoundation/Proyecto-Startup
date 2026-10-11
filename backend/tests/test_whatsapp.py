"""Webhook WhatsApp: verificación Meta, parseo e ingesta."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.whatsapp import router as wa_router
from app.db.base import Base
from app.db.session import get_db

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(wa_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)

META = {"object": "whatsapp_business_account",
        "entry": [{"changes": [{"value": {"messages": [
            {"from": "573144609907", "id": "wamid.1", "type": "text", "text": {"body": "¿qué servicios tienen?"}}]}}]}]}


def test_verify_ok_y_forbidden():
    ok = client.get("/api/v1/whatsapp/webhook", params={"hub.mode": "subscribe",
                     "hub.verify_token": "cytech-dev", "hub.challenge": "123"})
    assert ok.status_code == 200 and ok.text == "123"
    assert client.get("/api/v1/whatsapp/webhook", params={"hub.mode": "subscribe",
                      "hub.verify_token": "mal", "hub.challenge": "123"}).status_code == 403


def test_ingest_200_y_guarda():
    r = client.post("/api/v1/whatsapp/webhook", json=META)
    assert r.status_code == 200 and r.json() == {"received": True}
    db = TestingSession()
    from app.models.transaction import Transaction
    from sqlalchemy import select
    rows = db.scalars(select(Transaction).where(Transaction.provider == "whatsapp")).all()
    assert len(rows) == 1 and rows[0].payload.find("573144609907") >= 0
    db.close()


def test_ingest_sin_mensajes_igual_200():
    assert client.post("/api/v1/whatsapp/webhook", json={"object": "x"}).status_code == 200
