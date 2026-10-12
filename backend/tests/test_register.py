"""Registro local con contraseña (POST /auth/register) y login por password."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.db.base import Base
from app.db.session import get_db
from app.models.user import User
from app.services.auth_service import hash_password, password_policy_errors, verify_password

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _payload(**kw):
    base = {"name": "Nuevo Usuario", "email": "nuevo@proveedor.com", "password": "Segura123", "terms": True}
    base.update(kw)
    return base


def test_register_ok_y_emite_token():
    r = client.post("/api/v1/auth/register", json=_payload())
    assert r.status_code == 201
    body = r.json()
    assert body["token_type"] == "bearer"
    user = body["user"]
    assert user["email"] == "nuevo@proveedor.com"
    assert user["provider"] == "local"
    assert user["role"] == "client"
    assert user["terms_accepted_at"] is not None
    assert "password_hash" not in user  # el hash nunca sale en la API
    # El JWT emitido autentica de inmediato.
    me = client.get("/api/v1/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "nuevo@proveedor.com"


def test_register_rol_admin_por_dominio():
    r = client.post("/api/v1/auth/register", json=_payload(email="alta@cytech.com", name="Admin Nuevo"))
    assert r.status_code == 201
    assert r.json()["user"]["role"] == "admin"


def test_register_duplicado():
    client.post("/api/v1/auth/register", json=_payload(email="dup@proveedor.com"))
    r = client.post("/api/v1/auth/register", json=_payload(email="dup@proveedor.com"))
    assert r.status_code == 409
    assert "registrado" in r.json()["detail"]


def test_register_password_debil():
    r = client.post("/api/v1/auth/register", json=_payload(email="debil@x.com", password="abcdefg"))
    assert r.status_code == 400
    assert "mayúscula" in r.json()["detail"]
    r2 = client.post("/api/v1/auth/register", json=_payload(email="debil2@x.com", password="Abcdefgh"))
    assert r2.status_code == 400
    assert "dígito" in r2.json()["detail"]
    r3 = client.post("/api/v1/auth/register", json=_payload(email="debil3@x.com", password="Abc1"))
    assert r3.status_code == 400
    assert "8 caracteres" in r3.json()["detail"]


def test_register_email_invalido_sin_terminos_nombre_corto():
    bad = client.post("/api/v1/auth/register", json=_payload(email="no-es-email"))
    assert bad.status_code == 422
    sin = client.post("/api/v1/auth/register", json=_payload(email="sin-terminos@x.com", terms=False))
    assert sin.status_code == 400
    assert "términos" in sin.json()["detail"]
    corto = client.post("/api/v1/auth/register", json=_payload(name="A"))
    assert corto.status_code == 422


def test_login_password_ok_y_fallos():
    client.post("/api/v1/auth/register", json=_payload(email="login@proveedor.com", password="Segura123"))
    ok = client.post("/api/v1/auth/login", json={"email": "login@proveedor.com", "password": "Segura123"})
    assert ok.status_code == 200
    assert ok.json()["user"]["provider"] == "local"
    bad = client.post("/api/v1/auth/login", json={"email": "login@proveedor.com", "password": "Otra12345"})
    assert bad.status_code == 401
    assert bad.json()["detail"] == "Credenciales inválidas"
    # Anti-enumeración: un email inexistente responde exactamente igual.
    ghost = client.post("/api/v1/auth/login", json={"email": "nadie@x.com", "password": "Otra12345"})
    assert ghost.status_code == 401
    assert ghost.json()["detail"] == "Credenciales inválidas"


def test_login_federado_sin_password_falla():
    db = TestingSession()
    db.add(User(email="federado@x.com", name="Fed", provider="google", role="client"))
    db.commit()
    db.close()
    r = client.post("/api/v1/auth/login", json={"email": "federado@x.com", "password": "Segura123"})
    assert r.status_code == 401  # sin password_hash → nunca entra por password


def test_login_inactivo():
    client.post("/api/v1/auth/register", json=_payload(email="inactiva@x.com", password="Segura123"))
    db = TestingSession()
    user = db.scalar(select(User).where(User.email == "inactiva@x.com"))
    user.status = "inactive"
    db.commit()
    db.close()
    r = client.post("/api/v1/auth/login", json={"email": "inactiva@x.com", "password": "Segura123"})
    assert r.status_code == 403
    assert "inactivo" in r.json()["detail"]


def test_password_hash_roundtrip():
    stored = hash_password("Segura123")
    assert stored.startswith("pbkdf2_sha256$")
    assert verify_password("Segura123", stored)
    assert not verify_password("segura123", stored)
    assert not verify_password("Segura123", None)
    assert not verify_password("Segura123", "formato-raro")
    assert hash_password("Segura123") != stored  # salt distinto por hash


def test_password_policy():
    assert password_policy_errors("Segura123") == []
    assert password_policy_errors("abc") == [
        "al menos 8 caracteres",
        "al menos una mayúscula",
        "al menos un dígito",
    ]
