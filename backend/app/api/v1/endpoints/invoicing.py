"""PayPal Invoicing v2: crear, enviar y hacer seguimiento de facturas.

Flujo: create (borrador) → send (SENT + página de pago hospedada) →
recordatorio / pago externo / cancelación → conciliación en el libro
(transactions). El listado es un proxy de PayPal: sin credenciales responde
503 como el resto de payments, y quien no tiene `payments:view` solo ve las
facturas en las que es destinatario.
"""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from app.core.rbac import RequirePermission, is_allowed
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.services import paypal_service
from app.api.v1.endpoints.payments import _ledger

router = APIRouter(prefix="/paypal/invoices", tags=["paypal-invoicing"])

# Monedas admitidas por Invoicing (la pasarela valida además del backend).
CURRENCIES = ("USD", "EUR", "GBP", "CAD", "AUD", "MXN", "BRL")


class InvoiceItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    quantity: int = Field(default=1, ge=1, le=999)
    unit_amount: str  # "150.00" (siempre punto decimal, como exige PayPal)
    tax_percent: str | None = None


class InvoiceIn(BaseModel):
    email: EmailStr
    customer_name: str = ""
    currency: str = "USD"
    items: list[InvoiceItemIn] = Field(min_length=1, max_length=20)
    note: str = ""
    issue_date: str | None = None  # YYYY-MM-DD (default: hoy → envío inmediato)
    send: bool = True  # crear y enviar de una vez
    send_email: bool = True  # False: solo link/QR (nosotros lo compartimos)


class PaymentIn(BaseModel):
    amount: str
    currency: str = "USD"
    note: str = ""


def _recipient(inv: dict) -> str:
    """Email del cliente de una factura (lista o detalle)."""
    for r in (inv or {}).get("primary_recipients") or []:
        email = (r or {}).get("email_address")
        if email:
            return str(email).lower()
    return ""


def _pay_url(inv: dict) -> str:
    """URL de la página de pago hospedada (metadata o link payer-view)."""
    url = ((inv or {}).get("metadata") or {}).get("recipient_view_url") or ""
    if not url:
        url = next((l.get("href", "") for l in (inv or {}).get("links") or []
                    if l.get("rel") == "payer-view"), "")
    return url


def _inv_id(data: dict) -> str:
    return str(data.get("id") or data.get("invoice_id") or "")


def _require_visible(inv: dict, current: User, db: Session) -> None:
    """payments:view ve todo; el resto solo sus propias facturas."""
    if is_allowed(current.role, "payments", "view", db):
        return
    if _recipient(inv) != (current.email or "").lower():
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Esta factura no te pertenece")


def _build(body: InvoiceIn) -> dict:
    if body.currency not in CURRENCIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"Moneda no admitida por PayPal Invoicing: {body.currency}")
    items = []
    for it in body.items:
        money = paypal_service._money(it.unit_amount, body.currency)  # valida > 0
        node: dict = {"name": it.name, "unit_amount": money, "quantity": str(it.quantity)}
        if it.tax_percent:
            node["tax"] = {"percent": it.tax_percent}
        items.append(node)
    payload: dict = {
        "primary_recipients": [{"email_address": str(body.email),
                                **({"name": {"given_name": body.customer_name or str(body.email)}}
                                   if body.customer_name else {})}],
        "items": items,
    }
    if body.issue_date:
        payload["issue_date"] = body.issue_date
    if body.note:
        payload["note"] = body.note
    return payload


@router.post("")
def create(body: InvoiceIn, current: User = Depends(get_current_user),
           db: Session = Depends(get_db),
           _: User = Depends(RequirePermission("payments", "manage"))):
    """Crea el borrador y, opcionalmente, lo envía (o lo deja en estado de pago)."""
    out = paypal_service.invoice_create(_build(body))
    inv_id = _inv_id(out)
    if body.send and inv_id:
        out = {**out, "send": paypal_service.invoice_send(inv_id, body.send_email)}
    out["invoice_id"] = inv_id
    _ledger(db, current.id, "invoice", out, _amount_cents(out))
    return out


@router.get("")
def list_invoices(page: int = Query(1, ge=1), page_size: int = Query(20, ge=1, le=50),
                  current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    data = paypal_service.invoice_list(page, page_size)
    if not is_allowed(current.role, "payments", "view", db):
        mine = [i for i in data.get("invoices", []) if _recipient(i) == (current.email or "").lower()]
        data = {**data, "invoices": mine, "total_items": len(mine)}
    return data


@router.get("/{invoice_id}")
def read(invoice_id: str, current: User = Depends(get_current_user),
         db: Session = Depends(get_db)):
    inv = paypal_service.invoice_get(invoice_id)
    _require_visible(inv, current, db)
    return {**inv, "pay_url": _pay_url(inv)}


@router.post("/{invoice_id}/send", dependencies=[Depends(RequirePermission("payments", "manage"))])
def send(invoice_id: str, send_to_recipient: bool = True):
    return paypal_service.invoice_send(invoice_id, send_to_recipient)


@router.post("/{invoice_id}/reminders", dependencies=[Depends(RequirePermission("payments", "manage"))])
def remind(invoice_id: str):
    return paypal_service.invoice_reminder(invoice_id)


@router.post("/{invoice_id}/cancel", dependencies=[Depends(RequirePermission("payments", "manage"))])
def cancel(invoice_id: str):
    return paypal_service.invoice_cancel(invoice_id)


@router.get("/{invoice_id}/qr-code")
def qr(invoice_id: str, current: User = Depends(get_current_user),
       db: Session = Depends(get_db)):
    inv = paypal_service.invoice_get(invoice_id)
    _require_visible(inv, current, db)
    return {**paypal_service.invoice_qr(invoice_id), "pay_url": _pay_url(inv)}


@router.post("/{invoice_id}/payments", dependencies=[Depends(RequirePermission("payments", "manage"))])
def record_payment(invoice_id: str, body: PaymentIn, current: User = Depends(get_current_user),
                   db: Session = Depends(get_db)):
    """Pago externo (transferencia/efectivo): lo concilia en nuestro libro."""
    out = paypal_service.invoice_record_payment(invoice_id, body.amount, body.currency, body.note)
    _ledger(db, current.id, "payment", out, _amount_cents(out))
    return out


def _amount_cents(data: dict) -> int:
    """Monto en centavos (defensivo ante variantes de forma del objeto invoice)."""
    raw = data.get("amount")
    value = raw.get("value") if isinstance(raw, dict) else raw
    if value in (None, ""):
        value = data.get("amount_due") or data.get("total_amount") or 0
        if isinstance(value, dict):
            value = value.get("value", 0)
    try:
        return max(int(round(float(str(value or 0)) * 100)), 0)
    except (ValueError, TypeError):
        return 0
