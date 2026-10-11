"""Compatibilidad v6: POST /paypal-api/checkout/orders/create → {id, ...}.

El componente paypal-payments v6 lo consume así:
    fetch("/paypal-api/checkout/orders/create", {...})
      .then(r => r.json()).then(data => ({ orderId: data.id }));
Público pero restringido a donaciones (USD, montos fijos, CAPTURE).
"""
import json

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.transaction import Transaction
from app.services import paypal_service

router = APIRouter(prefix="/paypal-api", tags=["paypal-compat"])

ALLOWED_USD = (3, 5, 10, 25, 50)


class MoneyIn(BaseModel):
    currency_code: str = "USD"
    value: str


class UnitIn(BaseModel):
    amount: MoneyIn
    invoice_id: str | None = None
    custom_id: str | None = None


class CompatOrderIn(BaseModel):
    intent: str = "CAPTURE"
    purchase_units: list[UnitIn] = []


@router.post("/checkout/orders/create", status_code=201)
def create(body: CompatOrderIn, db: Session = Depends(get_db)):
    if body.intent != "CAPTURE":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo intent CAPTURE")
    if len(body.purchase_units) != 1:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Una sola purchase_unit")
    unit = body.purchase_units[0]
    if unit.amount.currency_code != "USD":
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Solo USD")
    try:
        dollars = int(float(unit.amount.value))
    except ValueError:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto inválido")
    if dollars not in ALLOWED_USD or float(unit.amount.value) != dollars:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto no permitido")
    out = paypal_service.create_order(unit.amount.value, "USD", "CAPTURE",
                                      invoice_id=unit.invoice_id, custom_id=unit.custom_id)
    db.add(Transaction(
        user_id=None, provider="paypal", kind="donation", amount=dollars * 100,
        currency="USD", status="pending", external_id=out.get("id"),
        payload=json.dumps({"via": "v6-compat"}),
    ))
    db.commit()
    return out
