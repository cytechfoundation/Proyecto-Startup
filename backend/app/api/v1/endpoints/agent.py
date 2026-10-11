"""Orquestador del Agente IA: diálogo multiturno (slots) + RAG + suscripciones.

La lógica vive en `app.services.dialog_service`: aquí solo se expone la API.
Noticias solo vía panel admin; el chat público es de consulta/suscripción.
"""
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.conversation import Conversation
from app.models.knowledge import KnowledgeDoc
from app.models.subscriber import Subscriber
from app.models.user import User
from app.services import dialog_service, rag_service

router = APIRouter(prefix="/agent", tags=["agent"])


class ChatIn(BaseModel):
    message: str
    session_id: str | None = Field(
        default=None, max_length=120,
        description="Id de sesión del cliente. Si se envía, el agente recuerda el diálogo "
                    "entre turnos (slot-filling). Web: uuid generado en el widget; "
                    "WhatsApp: número de teléfono. Sin session_id la respuesta es stateless.",
    )
    channel: str = Field(default="web", max_length=20, description="Canal: web | whatsapp")


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


class SessionOut(BaseModel):
    external_id: str
    channel: str
    flow: str | None
    step: str | None
    slots: dict
    history: list[dict]
    updated_at: datetime


@router.post("/chat")
def chat(body: ChatIn, db: Session = Depends(get_db)):
    """Punto único del asistente.

    Con `session_id` el diálogo es multiturno: el agente puede pedir un dato
    (correo, nombre, mensaje, impuesto) en un turno y usarlo en el siguiente.
    Sin `session_id` responde de forma aislada (compatible con integraciones
    que no guardan estado).
    """
    if not body.message.strip():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Mensaje vacío")
    return dialog_service.handle(db, body.message, session_id=body.session_id, channel=body.channel)


@router.get("/conversations/{external_id}", response_model=SessionOut)
def get_conversation(external_id: str, channel: str = "web", db: Session = Depends(get_db),
                     _: User = Depends(require_admin)):
    """Inspección de una sesión del agente (estado, slots e historial). Admin."""
    conv = db.scalar(select(Conversation).where(
        Conversation.channel == channel.strip().lower(), Conversation.external_id == external_id))
    if conv is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Sesión no encontrada")
    return SessionOut(external_id=conv.external_id, channel=conv.channel, flow=conv.flow, step=conv.step,
                      slots=conv.get_slots(), history=conv.get_history(), updated_at=conv.updated_at)


@router.delete("/conversations/{external_id}", status_code=204)
def delete_conversation(external_id: str, channel: str = "web", db: Session = Depends(get_db)):
    """Reinicia una sesión del diálogo (el widget lo hace creando un uuid nuevo)."""
    dialog_service.reset_conversation(db, external_id, channel)


@router.post("/subscribe")
def subscribe(body: SubscribeIn, db: Session = Depends(get_db)):
    return dialog_service.subscribe_email(db, str(body.email), body.message)


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
