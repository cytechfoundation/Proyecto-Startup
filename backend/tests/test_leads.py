"""Leads: validación de campos, captcha y lectura admin."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.leads import router as leads_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(leads_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)

GOOD = {"nombre": "Ana", "apellidos": "Ruiz", "empresa": "Retail SAS", "nit": "900123456-7",
        "cargo": "CFO", "email": "ana@retail.com", "telefono": "3001112222", "ciudad": "Bogotá",
        "opcion": "100-1000 docs/mes", "captcha": {"a": 4, "b": 6, "answer": 10}}


def _admin_h():
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email="l@cytech.com", name="L", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


def test_lead_ok():
    r = client.post("/api/v1/leads", json=GOOD)
    assert r.status_code == 201 and r.json()["nit"] == "900123456-7"


def test_lead_captcha_malo_y_campos():
    bad = dict(GOOD, captcha={"a": 4, "b": 6, "answer": 9})
    assert client.post("/api/v1/leads", json=bad).status_code == 400
    missing = dict(GOOD, nit="  ")
    assert client.post("/api/v1/leads", json=missing).status_code == 400


def test_leads_solo_admin():
    assert client.get("/api/v1/leads").status_code in (401, 403)
    assert len(client.get("/api/v1/leads", headers=_admin_h()).json()) >= 1
