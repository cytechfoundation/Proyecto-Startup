"""Pagos PayPal v2: Orders v2 (ciclo) + Payments v2 (post-aprobación) + libro contable."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.rbac import RequirePermission
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.services import card_errors, paypal_service

router = APIRouter(prefix="/payments", tags=["payments"])


class OrderItemIn(BaseModel):
    name: str = Field(min_length=1, max_length=127)
    unit_amount: str
    quantity: int = Field(default=1, ge=1, le=100)
    category: str | None = None  # PHYSICAL_GOODS | DIGITAL_GOODS | DONATION
    description: str | None = None
    sku: str | None = None
    tax: str | None = None  # impuesto del ítem (monto, no porcentaje)


class OrderShippingIn(BaseModel):
    full_name: str = ""
    address_line_1: str = ""
    address_line_2: str | None = None
    admin_area_2: str | None = None  # ciudad
    admin_area_1: str | None = None  # estado / provincia
    postal_code: str | None = None
    country_code: str = ""  # ISO-3166 alfa-2


class OrderBreakdownIn(BaseModel):
    """Desglose del monto (solo tiene sentido con items)."""
    shipping: str = "0"
    handling: str = "0"
    tax_total: str = "0"
    shipping_discount: str = "0"


class OrderIn(BaseModel):
    amount: str
    currency: str = "USD"
    intent: str = "CAPTURE"
    return_url: str = ""
    cancel_url: str = ""
    invoice_id: str | None = None
    custom_id: str | None = None
    payment_method: str | None = None  # card | paypal | google_pay | apple_pay
    # Esquema completo (opcional): carrito itemizado como en la referencia v2
    reference_id: str | None = None
    description: str | None = None
    soft_descriptor: str | None = None
    processing_instruction: str | None = None  # ORDER_COMPLETE_ON_PAYMENT_APPROVAL | CAPTURE
    items: list[OrderItemIn] = []
    shipping: OrderShippingIn | None = None
    breakdown: OrderBreakdownIn | None = None


class CaptureAuthIn(BaseModel):
    amount: str | None = None
    currency: str = "USD"
    final_capture: bool = True
    invoice_id: str | None = None


class RefundIn(BaseModel):
    amount: str | None = None
    currency: str = "USD"
    note_to_payer: str | None = None
    custom_id: str | None = None


class CardErrorIn(BaseModel):
    brand: str = "visa"
    avs_code: str | None = None
    cvv_code: str | None = None


class DonateOrderIn(BaseModel):
    amount_usd: int  # montos fijos anti-abuso
    cause: str = "becas"


DONATE_AMOUNTS_USD = (3, 5, 10, 25, 50)
DONATE_CAUSES = ("becas", "equipos", "talleres")


@router.post("/donate/orders")
def donate_create(body: DonateOrderIn, db: Session = Depends(get_db)):
    """Orden pública de donación (Google Pay / checkout): montos fijos, causa validada."""
    if body.amount_usd not in DONATE_AMOUNTS_USD:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto no permitido")
    if body.cause not in DONATE_CAUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Causa inválida")
    out = paypal_service.create_order(str(body.amount_usd), "USD", "CAPTURE",
                                      custom_id=f"donacion-{body.cause}")
    db.add(Transaction(
        user_id=None, provider="paypal", kind="donation", amount=body.amount_usd * 100,
        currency="USD", status="pending", external_id=out.get("id"),
        payload=json.dumps({"cause": body.cause}),
    ))
    db.commit()
    return out


@router.post("/donate/orders/{order_id}/capture")
def donate_capture(order_id: str, db: Session = Depends(get_db)):
    """Captura solo órdenes de donación registradas en nuestro libro (anti-abuso)."""
    row = db.scalar(select(Transaction).where(
        Transaction.external_id == order_id,
        Transaction.provider == "paypal",
        Transaction.kind == "donation",
    ))
    if row is None:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Orden no registrada como donación")
    out = paypal_service.capture_order(order_id)
    norm = paypal_service.normalize_capture(out)
    row.status = norm["status"]
    if norm["amount_cents"]:
        row.amount = norm["amount_cents"]
        row.currency = norm["currency"]
    db.commit()
    return out


def _ledger(db: Session, user_id: str, kind: str, data: dict, amount_cents: int = 0) -> None:
    norm = paypal_service.normalize_capture(data) if kind in ("payment", "refund") and data else None
    db.add(Transaction(
        user_id=user_id, provider="paypal", kind=kind,
        amount=norm["amount_cents"] if norm and norm["amount_cents"] else amount_cents,
        currency=(norm["currency"] if norm else "USD"),
        status=(norm["status"] if norm else str(data.get("status", "pending")).lower()),
        external_id=(norm["external_id"] if norm else data.get("id")),
        payload=json.dumps(data)[:4000],
    ))
    db.commit()


@router.post("/orders", dependencies=[Depends(RequirePermission("payments", "manage"))])
def create(body: OrderIn, current: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    out = paypal_service.create_order(
        body.amount, body.currency, body.intent,
        body.return_url, body.cancel_url,
        body.invoice_id, body.custom_id, body.payment_method,
        reference_id=body.reference_id, description=body.description,
        soft_descriptor=body.soft_descriptor,
        processing_instruction=body.processing_instruction,
        items=[i.model_dump() for i in body.items] if body.items else None,
        shipping=body.shipping.model_dump() if body.shipping else None,
        breakdown=body.breakdown.model_dump() if body.breakdown else None,
    )
    _ledger(db, current.id, "payment", out)
    return out


@router.get("/orders/{order_id}", dependencies=[Depends(RequirePermission("payments", "view"))])
def read_order(order_id: str):
    return paypal_service.get_order(order_id)


@router.post("/orders/{order_id}/capture", dependencies=[Depends(RequirePermission("payments", "manage"))])
def capture(order_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = paypal_service.capture_order(order_id)
    _ledger(db, current.id, "payment", out)
    return out


@router.post("/orders/{order_id}/authorize", dependencies=[Depends(RequirePermission("payments", "manage"))])
def authorize(order_id: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    out = paypal_service.authorize_order(order_id)
    _ledger(db, current.id, "payment", out)
    return out


@router.get("/captures/{capture_id}", dependencies=[Depends(RequirePermission("payments", "view"))])
def read_capture(capture_id: str):
    out = paypal_service.get_capture(capture_id)
    decline = card_errors.from_processor_response(out.get("processor_response", {}))
    if decline:
        out = {**out, "decline_info": decline}
    return out


@router.post("/captures/{capture_id}/refund", dependencies=[Depends(RequirePermission("payments", "manage"))])
def refund(capture_id: str, body: RefundIn, current: User = Depends(get_current_user),
           db: Session = Depends(get_db)):
    out = paypal_service.refund_capture(capture_id, body.amount, body.currency,
                                        body.note_to_payer, body.custom_id)
    _ledger(db, current.id, "refund", out)
    return out


@router.get("/authorizations/{auth_id}", dependencies=[Depends(RequirePermission("payments", "view"))])
def read_auth(auth_id: str):
    return paypal_service.get_authorization(auth_id)


@router.post("/authorizations/{auth_id}/capture", dependencies=[Depends(RequirePermission("payments", "manage"))])
def capture_auth(auth_id: str, body: CaptureAuthIn, current: User = Depends(get_current_user),
                 db: Session = Depends(get_db)):
    out = paypal_service.capture_authorization(auth_id, body.amount, body.currency,
                                               body.final_capture, body.invoice_id)
    _ledger(db, current.id, "payment", out)
    return out


@router.post("/authorizations/{auth_id}/void", dependencies=[Depends(RequirePermission("payments", "manage"))])
def void_auth(auth_id: str):
    return paypal_service.void_authorization(auth_id)


@router.get("/search", dependencies=[Depends(RequirePermission("payments", "view"))])
def search(start_date: str = Query(...), end_date: str = Query(...),
           page_size: int = Query(default=20, ge=1, le=100), page: int = Query(default=1, ge=1)):
    """Transaction Search: reemplazo de List Payments v1 (sin equivalente en v2)."""
    return paypal_service.search_transactions(start_date, end_date, page_size, page)


@router.get("/methods", dependencies=[Depends(RequirePermission("payments", "view"))])
def methods():
    """APMs habilitados para Colombia. PSE no es APM de PayPal: va por POS/pasarela propia."""
    return {"methods": paypal_service.PAYMENT_METHODS}


@router.post("/card-errors/interpret")
def interpret_card_error(body: CardErrorIn):
    """Explica un rechazo AVS/CVV en español (público: consulta estática)."""
    return card_errors.interpret(body.avs_code, body.cvv_code, body.brand)


@router.get("/client-token")
def client_token():
    """ClientToken para Web SDK v6 (público: solo identifica la sesión, no cobra)."""
    return paypal_service.generate_client_token()
