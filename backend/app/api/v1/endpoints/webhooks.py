"""Ingesta de webhooks (POS, DIAN, PayPal): siempre 2xx si el JSON es válido.

Guía PayPal aplicada:
- Responder 2xx rápido: PayPal reintenta hasta 25 veces / 3 días si no hay 2xx.
- Idempotencia: entregas duplicadas (mismo event_id) se confirman sin duplicar filas.
- Verificación: firma vía API (o CRC32); sin credenciales se marca `unverified`.
"""
import json
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user_integration import UserIntegration
from app.services import events, paypal_service

router = APIRouter(prefix="/webhooks", tags=["webhooks"])

PROVIDERS = ("paypal", "dian", "pos")
# Catálogo de eventos a los que suscribir la app PayPal (máx. 10 URLs / evento
# por app; los de fuera del catálogo también se aceptan y registran).
SUBSCRIBED_EVENTS = [
    # Payments v2
    "PAYMENT.AUTHORIZATION.CREATED",
    "PAYMENT.AUTHORIZATION.VOIDED",
    "PAYMENT.CAPTURE.COMPLETED",
    "PAYMENT.CAPTURE.PENDING",
    "PAYMENT.CAPTURE.DECLINED",
    "PAYMENT.CAPTURE.DENIED",
    "PAYMENT.CAPTURE.REFUNDED",
    "PAYMENT.CAPTURE.REVERSED",
    "PAYMENT.REFUND.PENDING",
    "PAYMENT.REFUND.FAILED",
    # Orders v2
    "CHECKOUT.ORDER.APPROVED",
    "CHECKOUT.ORDER.COMPLETED",
    "CHECKOUT.PAYMENT-APPROVAL.REVERSED",
    # Invoicing
    "INVOICING.INVOICE.CREATED",
    "INVOICING.INVOICE.SCHEDULED",
    "INVOICING.INVOICE.UPDATED",
    "INVOICING.INVOICE.PAID",
    "INVOICING.INVOICE.REFUNDED",
    "INVOICING.INVOICE.CANCELLED",
    # Disputes (alertas)
    "CUSTOMER.DISPUTE.CREATED",
    "CUSTOMER.DISPUTE.UPDATED",
    "CUSTOMER.DISPUTE.RESOLVED",
    # Log in with PayPal
    "IDENTITY.AUTHORIZATION-CONSENT.REVOKED",
]


def _topic(event_type: str) -> str:
    """cytech.paypal.payment.capture.completed | invoicing.invoice.paid | ..."""
    parts = (event_type or "unknown.event").split(".")
    return f"cytech.paypal.{'.'.join(parts[:2]).lower()}.{parts[-1].lower()}"


def _reconcile(db: Session, event_type: str, resource: dict) -> dict:
    """Sincroniza el libro (transacciones de negocio) con el estado de PayPal.

    - capturas/reembolsos/órdenes: casan por external_id (id del recurso o del
      orden relacionado en supplementary_data.related_ids) → estado y monto;
    - facturas: casan por el id de factura; si quedó PAGADA se registra el
      pago en el libro (idempotente ante reintentos);
    - disputas: solo alerta (sin fila de negocio).
    """
    if event_type.startswith("CUSTOMER.DISPUTE"):
        return {"actualizadas": 0, "creadas": 0}
    rid = str(resource.get("id") or "")
    status = str(resource.get("status") or event_type.split(".")[-1]).lower()
    updated = created = 0
    if event_type.startswith("INVOICING.INVOICE."):
        row = db.scalar(select(Transaction).where(
            Transaction.provider == "paypal", Transaction.kind == "invoice",
            Transaction.external_id == rid))
        if row is not None:
            if row.status != status:
                row.status = status
                updated += 1
            if event_type == "INVOICING.INVOICE.PAID":
                pagado = db.scalar(select(Transaction).where(
                    Transaction.provider == "paypal", Transaction.kind == "payment",
                    Transaction.external_id == rid))
                if pagado is None:
                    norm = paypal_service.normalize_capture(resource)
                    db.add(Transaction(user_id=row.user_id, provider="paypal", kind="payment",
                                       amount=norm["amount_cents"] or row.amount,
                                       currency=norm["currency"] or row.currency,
                                       status="completed", external_id=rid,
                                       payload=json.dumps(resource)[:4000]))
                    created += 1
        db.commit()
        return {"actualizadas": updated, "creadas": created}
    ids = [rid]
    order_id = (((resource.get("supplementary_data") or {}).get("related_ids") or {}).get("order_id"))
    if order_id:
        ids.append(str(order_id))
    rows = db.scalars(select(Transaction).where(
        Transaction.provider == "paypal", Transaction.kind != "webhook",
        Transaction.external_id.in_(ids))).all()
    norm = paypal_service.normalize_capture(resource)
    for row in rows:
        if row.status != status:
            row.status = status
            updated += 1
        if norm["amount_cents"] and not row.amount:
            row.amount = norm["amount_cents"]
            row.currency = norm["currency"]
    db.commit()
    return {"actualizadas": updated, "creadas": created}


def _revocar_consentimiento(db: Session, resource: dict) -> int:
    """IDENTITY.AUTHORIZATION-CONSENT.REVOKED: el usuario revocó el acceso en
    PayPal; su integración deja de estar verificada."""
    email = str(resource.get("email") or "").lower()
    if not email:
        return 0
    rows = db.scalars(select(UserIntegration).where(
        UserIntegration.provider == "paypal",
        func.lower(UserIntegration.account) == email)).all()
    for row in rows:
        row.verified = False
    db.commit()
    return len(rows)


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
    result = {"received": True, "provider": provider, "verified": verified,
              "event_type": payload.get("event_type"),
              "at": datetime.now(timezone.utc).isoformat()}
    if provider == "paypal" and isinstance(payload.get("resource"), dict):
        event_type = str(payload.get("event_type") or "")
        try:  # el 2xx a PayPal no depende de la conciliación
            result["reconciled"] = _reconcile(db, event_type, payload["resource"])
            if event_type == "IDENTITY.AUTHORIZATION-CONSENT.REVOKED":
                result["reconciled"]["integraciones"] = _revocar_consentimiento(db, payload["resource"])
        except Exception as e:
            result["reconciled"] = {"error": str(e)}
        events.publish(_topic(event_type), {"event_type": event_type,
                                            "resource_id": payload["resource"].get("id"),
                                            "status": payload["resource"].get("status")})
    return result
