"""Donaciones: registro público + lectura admin."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.donations import router as donations_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(donations_router, prefix="/api/v1")


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


def test_pledge_ok():
    r = client.post("/api/v1/donations", json={"name": "Ana", "email": "ana@mail.com", "amount": 25000, "cause": "becas"})
    assert r.status_code == 201
    assert r.json()["amount"] == 25000


def test_pledge_invalido():
    assert client.post("/api/v1/donations", json={"name": "A", "email": "x@mail.com", "amount": 10, "cause": "becas"}).status_code == 400
    assert client.post("/api/v1/donations", json={"name": "Ana", "email": "ana@mail.com", "amount": 0, "cause": "becas"}).status_code == 400
    assert client.post("/api/v1/donations", json={"name": "Ana", "email": "ana@mail.com", "amount": 10, "cause": "otra"}).status_code == 400


def test_list_solo_admin():
    client.post("/api/v1/donations", json={"name": "Luis", "email": "l@mail.com", "amount": 50000, "cause": "talleres"})
    assert client.get("/api/v1/donations").status_code in (401, 403)
    r = client.get("/api/v1/donations", headers=_admin_h())
    assert r.status_code == 200 and len(r.json()["items"]) >= 2


def test_list_paginada():
    h = _admin_h()
    r = client.get("/api/v1/donations", params={"page": 1, "page_size": 1}, headers=h).json()
    assert (r["total"], r["page"], r["page_size"], r["pages"]) == (r["total"], 1, 1, r["total"])
    assert len(r["items"]) == 1
