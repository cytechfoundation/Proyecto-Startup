"""Orquestador del Agente IA: enrutamiento de intenciones + RAG + suscripciones."""
import re
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.knowledge import KnowledgeDoc
from app.models.subscriber import Subscriber
from app.models.user import User
from app.services import email_service, events, rag_service

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatIn(BaseModel):
    message: str


class KnowledgeIn(BaseModel):
    title: str
    content: str
    source: str = "corporate"


class KnowledgeOut(BaseModel):
    id: str
    title: str
    source: str
    created_at: datetime

    model_config = {"from_attributes": True}


class SubscribeIn(BaseModel):
    email: EmailStr
    message: str = "¡Suscripción confirmada!"


NEWS_RE = re.compile(r"noticia\s*:\s*(?P<title>[^|]+)\|\s*(?P<content>.+)", re.IGNORECASE | re.DOTALL)
SUB_RE = re.compile(r"suscribir(?:me|se)?\s*:\s*(?P<email>\S+@\S+)", re.IGNORECASE)


def _intent(message: str) -> tuple[str, dict]:
    """Enrutador de intenciones (reglas; el LLM solo genera la respuesta final)."""
    if m := NEWS_RE.search(message):
        return "ACTUALIZAR_NOTICIA", {"title": m.group("title").strip(), "content": m.group("content").strip()}
    if m := SUB_RE.search(message):
        return "RESPONDER_SUSCRIPCION", {"email": m.group("email").strip()}
    if "suscribir" in message.lower():
        return "RESPONDER_SUSCRIPCION_AYUDA", {}
    return "CONSULTA_GENERAL", {}


@router.post("/chat")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    """Punto único del asistente. Noticias solo vía panel admin (requiere rol)."""
    if not body.message.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mensaje vacío")
    intent, data = _intent(body.message)
    if intent == "ACTUALIZAR_NOTICIA":
        return {"intent": intent, "success": False,
                "reply": "Solo un Administrador puede indexar noticias (usa el panel Base de conocimiento)."}
    if intent == "RESPONDER_SUSCRIPCION":
        return _subscribe(db, data["email"], "¡Suscripción confirmada!")
    if intent == "RESPONDER_SUSCRIPCION_AYUDA":
        return {"intent": intent, "success": True,
                "reply": "Para suscribirte escribe: suscribir: tu@correo.com"}
    result = rag_service.answer(db, body.message)
    return {"intent": "CONSULTA_GENERAL", "success": True, **result}


def _subscribe(db: Session, email: str, message: str) -> dict:
    existing = db.scalar(select(Subscriber).where(Subscriber.email == email.lower()))
    if existing is None:
        db.add(Subscriber(email=email.lower()))
        db.commit()
    events.publish("cytech.subscriptions.created", {"email": email.lower()})
    sent = email_service.send(email, "¡Suscripción confirmada! — Cytech", message)
    return {"intent": "RESPONDER_SUSCRIPCION", "success": True,
            "reply": f"Suscripción procesada y alerta enviada a {email} (canal: {sent['channel']})."}


@router.post("/subscribe")
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)):
    return _subscribe(db, str(body.email), body.message)


@router.get("/knowledge", response_model=list[KnowledgeOut])
def list_knowledge(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [KnowledgeOut.model_validate(d) for d in db.scalars(select(KnowledgeDoc).order_by(KnowledgeDoc.created_at.desc())).all()]


@router.post("/knowledge", response_model=KnowledgeOut, status_code=201)
def add_knowledge(body: KnowledgeIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """Inyección en caliente al RAG (noticia o documento corporativo)."""
    if len(body.title.strip()) < 3 or len(body.content.strip()) < 10:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Título/contenido muy cortos")
    doc = rag_service.add_document(db, body.title, body.content, body.source or "corporate")
    return KnowledgeOut.model_validate(doc)


@router.get("/subscribers")
def list_subscribers(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [{"email": s.email, "created_at": s.created_at} for s in db.scalars(select(Subscriber)).all()]
