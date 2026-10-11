"""Agente IA: intenciones, RAG extractivo y suscripciones (sin key externa)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.agent import router as agent_router
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
app.include_router(agent_router, prefix="/api/v1")


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


def test_chat_sin_conocimiento():
    r = client.post("/api/v1/agent/chat", json={"message": "¿qué es Cytech?"})
    assert r.status_code == 200 and r.json()["intent"] == "CONSULTA_GENERAL"


def test_chat_vacio():
    assert client.post("/api/v1/agent/chat", json={"message": "  "}).status_code == 400


def test_noticia_por_chat_bloqueada():
    r = client.post("/api/v1/agent/chat", json={"message": "noticia: Lanzamiento | Abrimos sede"})
    assert r.json()["success"] is False


def test_suscripcion_por_chat():
    r = client.post("/api/v1/agent/chat", json={"message": "suscribir: ana@mail.com"})
    assert r.json()["success"] is True and "ana@mail.com" in r.json()["reply"]


def test_knowledge_crud_y_respuesta():
    h = _admin_h()
    assert client.get("/api/v1/agent/knowledge", headers=h).status_code == 200
    doc = client.post("/api/v1/agent/knowledge",
                      json={"title": "Cytech factura DIAN", "content": "Cytech emite facturación electrónica validada ante la DIAN con conciliación automática."},
                      headers=h)
    assert doc.status_code == 201
    r = client.post("/api/v1/agent/chat", json={"message": "¿cómo es la facturación DIAN?"})
    assert r.json()["sources"] == ["Cytech factura DIAN"]
    assert "DIAN" in r.json()["reply"]


def test_subscribe_endpoint_y_listado():
    assert client.post("/api/v1/agent/subscribe", json={"email": "luis@mail.com"}).status_code == 200
    assert client.get("/api/v1/agent/subscribers").status_code in (401, 403)
    lst = client.get("/api/v1/agent/subscribers", headers=_admin_h()).json()
    assert any(s["email"] == "luis@mail.com" for s in lst)
