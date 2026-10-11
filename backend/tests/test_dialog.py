"""Agente multiturno: flujos guiados con slot-filling, sesiones e historial.

Cubre los tres flujos (suscripción, contacto, calendario tributario), la
cancelación, el aislamiento de sesiones/canales y el contrato stateless
histórico (sin session_id).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.agent import router as agent_router
from app.api.v1.endpoints.auth import router as auth_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.subscriber import Subscriber
from app.services.auth_service import FederatedIdentity, get_or_create_user
from app.services import dialog_service

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


def _chat(message, session_id=None, channel="web"):
    return client.post("/api/v1/agent/chat", json={"message": message, "session_id": session_id,
                                                   "channel": channel}).json()


def _admin_h():
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email="a@cytech.com", name="A", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


# ---------------------------------------------------------------- stateless
def test_stateless_sin_session_id_no_crea_conversacion():
    _chat("suscribir: sin.sessiona@mail.com")
    db = TestingSession()
    assert db.scalar(select(Conversation).where(Conversation.external_id == "sin.sessiona@mail.com")) is None
    db.close()


def test_stateless_contrato_historico():
    assert _chat("suscribirme")["intent"] == "RESPONDER_SUSCRIPCION_AYUDA"
    r = _chat("suscribir: single.turn@mail.com")
    assert r["success"] is True and "single.turn@mail.com" in r["reply"]
    assert _chat("noticia: Lanzamiento | Abrimos sede")["success"] is False
    assert client.post("/api/v1/agent/chat", json={"message": "   "}).status_code == 400


# ---------------------------------------------------------------- suscripción
def test_flujo_suscripcion_dos_turnos():
    r1 = _chat("hola, quiero suscribirme", session_id="s-sub")
    assert r1["flow"] == "subscribe" and r1["step"] == "email" and "correo" in r1["reply"].lower()
    r2 = _chat("mi correo es ana.multiple@mail.com", session_id="s-sub")
    assert r2["success"] is True and r2["flow"] is None
    db = TestingSession()
    assert db.scalar(select(Subscriber).where(Subscriber.email == "ana.multiple@mail.com")) is not None
    db.close()


def test_flujo_suscripcion_rechaza_email_invalido_y_persiste_estado():
    _chat("suscribirme", session_id="s-retry")
    r = _chat("no soy un correo", session_id="s-retry")
    assert r["success"] is False and r["flow"] == "subscribe" and r["step"] == "email"
    assert _chat("ok@mail.co", session_id="s-retry")["flow"] is None


def test_suscripcion_completa_en_un_turno_con_sesion():
    r = _chat("suscribir: un.turno@mail.com", session_id="s-one")
    assert r["intent"] == "RESPONDER_SUSCRIPCION" and r["flow"] is None


# ---------------------------------------------------------------- contacto
def test_flujo_contacto_tres_pasos():
    r1 = _chat("necesito contactar con un asesor", session_id="s-contact")
    assert r1["flow"] == "contact" and "nombre" in r1["reply"].lower()
    r2 = _chat("Carla Gómez", session_id="s-contact")
    assert r2["step"] == "email"
    r3 = _chat("carla@empresa.com", session_id="s-contact")
    assert r3["step"] == "message"
    r4 = _chat("Necesito facturación electrónica para mi PYME", session_id="s-contact")
    assert r4["intent"] == "CONTACTO_SOLICITADO" and r4["flow"] is None
    assert "Carla" in r4["reply"] and "carla@empresa.com" in r4["reply"]
    db = TestingSession()
    lead = db.scalar(select(Lead).where(Lead.email == "carla@empresa.com"))
    assert lead is not None and lead.opcion == "chat agente"
    db.close()


# ---------------------------------------------------------------- calendario
def test_flujo_tax_responde_con_rag():
    h = _admin_h()
    client.post("/api/v1/agent/knowledge",
                json={"title": "Calendario IVA Cytech",
                      "content": "La declaración del IVA del periodo 2026 se presenta y paga hasta el día 20 de cada mes."},
                headers=h)
    r1 = _chat("tengo una duda del calendario tributario", session_id="s-tax")
    assert r1["flow"] == "tax" and r1["step"] == "scope"
    r2 = _chat("IVA", session_id="s-tax")
    assert r2["intent"] == "CALENDARIO_TRIBUTARIO" and r2["flow"] is None
    assert "/calendario-tributario" in r2["reply"] and r2["sources"] == ["Calendario IVA Cytech"]


# ---------------------------------------------------------------- cancelación
def test_cancelar_cierra_el_flujo():
    _chat("quiero suscribirme", session_id="s-cancel")
    r = _chat("cancelar", session_id="s-cancel")
    assert r["intent"] == "CANCELAR" and r["flow"] is None
    db = TestingSession()
    conv = db.scalar(select(Conversation).where(Conversation.external_id == "s-cancel"))
    assert conv.flow is None and conv.get_slots() == {}
    db.close()


# ---------------------------------------------------------------- sesiones
def test_sesiones_aisladas_y_historial_persistido():
    _chat("quiero suscribirme", session_id="s-a")
    r = _chat("¿qué es Cytech?", session_id="s-b")
    assert r["flow"] is None, "la sesión B no hereda el flujo de la A"
    db = TestingSession()
    a = db.scalar(select(Conversation).where(Conversation.external_id == "s-a"))
    b = db.scalar(select(Conversation).where(Conversation.external_id == "s-b"))
    assert [t["role"] for t in a.get_history()] == ["user", "bot"]
    assert [t["role"] for t in b.get_history()] == ["user", "bot"]
    db.close()


def test_canal_web_y_whatsapp_no_colisionan():
    _chat("suscribirme", session_id="57300111", channel="whatsapp")
    r = _chat("hola", session_id="57300111", channel="web")
    assert r["flow"] is None, "las sesiones de canales distintos son independientes"
    db = TestingSession()
    assert {c.channel for c in db.scalars(select(Conversation)).all()} >= {"web", "whatsapp"}
    db.close()


def test_servicio_directo_igual_que_endpoint():
    """El notifier de WhatsApp llama al servicio con canal/ sesión propios."""
    db = TestingSession()
    r = dialog_service.handle(db, "suscribirme", session_id="wa:+57300999", channel="whatsapp")
    assert r["flow"] == "subscribe"
    r2 = dialog_service.handle(db, "wa@mail.com", session_id="wa:+57300999", channel="whatsapp")
    assert r2["success"] is True and r2["flow"] is None
    db.close()


# ---------------------------------------------------------------- inspección
def test_endpoint_conversacion_admin():
    _chat("quiero suscribirme", session_id="s-insp")
    assert client.get("/api/v1/agent/conversations/s-insp").status_code in (401, 403)
    h = _admin_h()
    r = client.get("/api/v1/agent/conversations/s-insp", headers=h)
    assert r.status_code == 200
    body = r.json()
    assert body["flow"] == "subscribe" and body["step"] == "email" and body["channel"] == "web"
    assert body["history"] and body["history"][0]["text"] == "quiero suscribirme"
    assert client.get("/api/v1/agent/conversations/no-existe", headers=h).status_code == 404


def test_reset_conversacion():
    _chat("suscribirme", session_id="s-reset")
    assert client.delete("/api/v1/agent/conversations/s-reset").status_code == 204
    db = TestingSession()
    assert db.scalar(select(Conversation).where(Conversation.external_id == "s-reset")) is None
    db.close()
