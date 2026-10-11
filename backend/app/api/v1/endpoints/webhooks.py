"""Ingesta de webhooks (POS, DIAN, PayPal): siempre 2xx si el JSON es válido.

Guía PayPal aplicada:
- Responder 2xx rápido: PayPal reintenta hasta 25 veces / 3 días si no hay 2xx.
- Idempotencia: entregas duplicadas (mismo event_id) se confirman sin duplicar filas.
- Verificación: firma vía API (o CRC32); sin credenciales se marca `unverified`.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.transaction import Transaction
from app.services import events, paypal_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PROVIDERS = ("paypal", "dian", "pos")
SUBSCRIBED_EVENTS = [
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.PENDING",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.REFUNDED",
    "PAYMENT.AUTHORIZATION.CREATED",
    "PAYMENT.AUTHORIZATION.VOIDED",
    "CHECKOUT.ORDER.APPROVED",
]


@router.get("")
def info():
    """Nuestras URLs de escucha y política de reintentos (hasta 10 URLs por app PayPal)."""
    return {
        "listeners": [f"/webhooks/{p}" for p in PROVIDERS],
        "subscribed_events": SUBSCRIBED_EVENTS,
        "success_codes": [200],
        "retries": "PayPal reintenta hasta 25 veces / 3 días sin 2xx",
        "verification": "verify-webhook-signature" if settings.paypal_webhook_id else "unverified (falta PAYPAL_WEBHOOK_ID)",
    }


@router.post("/{provider}")
async def ingest(provider: str, request: Request, db: Session = Depends(get_db)):
    if provider not in PROVIDERS:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Proveedor inválido")
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "JSON inválido")
    if not isinstance(payload, dict):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Se esperaba un objeto JSON")

    event_id = str(payload.get("id") or "")
    if event_id:  # idempotencia ante reintentos de PayPal
        existing = db.scalar(
            select(Transaction).where(Transaction.provider == provider, Transaction.event_id == event_id)
        )
        if existing is not None:
            return {"received": True, "provider": provider, "duplicate": True,
                    "at": datetime.now(timezone.utc).isoformat()}

    # Eventos PayPal (ej. PAYMENT.CAPTURE.COMPLETED) traen resource:{id,status,amount}
    event_payload = payload.get("resource") if isinstance(payload.get("resource"), dict) else payload
    norm = paypal_service.normalize_capture(event_payload) if provider == "paypal" else None

    verified = True
    if provider == "paypal":
        if settings.paypal_client_id and settings.paypal_client_secret and settings.paypal_webhook_id:
            try:  # el receptor nunca se cae: si falla la verificación, marca no verificado
                verified = paypal_service.verify_webhook_signature(
                    {k.lower(): v for k, v in request.headers.items()},
                    settings.paypal_webhook_id,
                    payload,
                )
            except Exception:
                verified = False
        else:
            verified = False  # sandbox sin credenciales: se registra como no verificado

    tx = Transaction(
        user_id=None,
        provider=provider,
        kind="webhook",
        amount=norm["amount_cents"] if norm else int(payload.get("amount_cents", 0) or 0),
        currency=norm["currency"] if norm else str(payload.get("currency", "COP")),
        status="verified" if verified else "unverified",
        external_id=(norm["external_id"] if norm else None)
        or str(payload.get("id") or payload.get("event_id") or "") or None,
        event_id=event_id or None,
        payload=json.dumps(payload)[:4000],
    )
    db.add(tx)
    db.commit()
    events.publish("cytech.webhooks.received", {"provider": provider, "verified": verified,
                                                "event_type": payload.get("event_type"),
                                                "event_id": event_id})
    return {"received": True, "provider": provider, "verified": verified,
            "event_type": payload.get("event_type"),
            "at": datetime.now(timezone.utc).isoformat()}
