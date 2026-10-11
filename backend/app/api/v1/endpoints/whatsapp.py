"""Webhook WhatsApp (Meta): validacion + recepcion inmediata + encolado async.

Equivale al router Express de referencia:
- GET: Meta valida con hub.mode/hub.verify_token/hub.challenge.
- POST: responde 200 de inmediato y encola en Kafka (topico whatsapp-messages)
  para que el consumidor responda con el RAG sin bloquear a Meta.
"""
import json

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import PlainTextResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.transaction import Transaction
from app.services import events, whatsapp_service

router = APIRouter(prefix="/whatsapp", tags=["whatsapp"])


@router.get("/webhook", response_class=PlainTextResponse)
def verify(mode: str | None = Query(default=None, alias="hub.mode", description="Modo de verificacion de Meta (debe ser 'subscribe')"),
           token: str | None = Query(default=None, alias="hub.verify_token", description="Token secreto configurado en Meta Developers"),
           challenge: str | None = Query(default=None, alias="hub.challenge", description="Valor aleatorio enviado por Meta para validar el endpoint")):
    """
    Valida el Webhook con Meta Cloud API.
    
    Este endpoint es llamado por Facebook mediante un GET para confirmar que el servidor 
    es dueño del token y puede responder el challenge.
    """
    if mode == "subscribe" and token == settings.whatsapp_verify_token:
        return PlainTextResponse(challenge or "", status_code=200)
    return PlainTextResponse("Forbidden", status_code=403)


@router.post("/webhook")
async def ingest(request: Request, db: Session = Depends(get_db)):
    """
    Recibe mensajes en tiempo real desde WhatsApp Cloud API.
    
    Procesa el JSON entrante, guarda la transaccion en la DB y encola el mensaje 
    en Kafka para que el agente RAG responda de forma asincrona.
    """
    try:
        payload = await request.json()
    except Exception:
        payload = {}
    for msg in whatsapp_service.parse_messages(payload if isinstance(payload, dict) else {}):
        db.add(Transaction(
            user_id=None, provider="whatsapp", kind="webhook", amount=0, currency="COP",
            status="received", external_id=msg["id"] or None, event_id=msg["id"] or None,
            payload=json.dumps(msg)[:1000],
        ))
        events.publish("cytech.whatsapp.incoming", msg)
    db.commit()
    return {"received": True}  # 200 inmediato: Meta no marca caido el webhook
