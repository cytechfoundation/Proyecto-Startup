"""Mi cuenta: resumen y edición propia del perfil."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.account import router as account_router
from app.api.v1.endpoints.auth import router as auth_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(account_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _token(email: str, role: str | None = None) -> str:
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email=email, name=email, provider="google"))
    if role:
        user.role = role
        db.commit()
        db.refresh(user)
    uid, r = str(user.id), user.role
    db.close()
    return create_access_token(subject=uid, role=r)


def test_summary_requiere_auth():
    assert client.get("/api/v1/account/summary").status_code in (401, 403)


def test_summary_y_perfil_propio():
    t = _token("cuenta@cytech.com")
    h = {"Authorization": f"Bearer {t}"}
    s = client.get("/api/v1/account/summary", headers=h)
    assert s.status_code == 200
    assert "dian:view" in s.json()["permissions"]

    p = client.put("/api/v1/account/profile", json={"name": "Cuenta", "company": "Cytech", "phone": "300", "nit": "900123456-7", "person_type": "juridica"}, headers=h)
    assert p.status_code == 200
    body = p.json()
    assert (body["name"], body["company"], body["phone"]) == ("Cuenta", "Cytech", "300")
    assert (body["nit"], body["person_type"]) == ("900123456-7", "juridica")
    bad = client.put("/api/v1/account/profile", json={"person_type": "otro"}, headers=h)
    assert bad.status_code == 422

    # El email no se puede cambiar desde el perfil (lo gobierna el IdP).
    assert body["email"] == "cuenta@cytech.com"


def test_terms_acceptance():
    t = _token("terminos@cytech.com")
    h = {"Authorization": f"Bearer {t}"}
    assert client.get("/api/v1/account/summary", headers=h).json()["user"]["terms_accepted_at"] is None
    r = client.put("/api/v1/account/terms", json={"accepted": True}, headers=h)
    assert r.status_code == 200 and r.json()["terms_accepted_at"] is not None
    r2 = client.put("/api/v1/account/terms", json={"accepted": False}, headers=h)
    assert r2.json()["terms_accepted_at"] is None


def test_self_delete_con_confirmacion():
    t = _token("borrame@gmail.com")
    h = {"Authorization": f"Bearer {t}"}
    bad = client.request("DELETE", "/api/v1/account/me", json={"email": "otro@gmail.com"}, headers=h)
    assert bad.status_code == 400
    ok = client.request("DELETE", "/api/v1/account/me", json={"email": "borrame@gmail.com"}, headers=h)
    assert ok.status_code == 204
    assert client.get("/api/v1/account/summary", headers=h).status_code == 401
