"""Cliente PayPal v2: Orders v2 (ciclo de pago) + Payments v2 (post-aprobación).

Alineado a la guía v1→v2: intents en mayúsculas, purchase_units con
value/currency_code, `Prefer: return=representation` en escrituras,
`PayPal-Request-Id` (idempotencia 6h), final_capture explícito,
webhooks en vez de IPN y Transaction Search en vez de List Payments.
"""
import uuid

import httpx
from fastapi import HTTPException, status

from app.core.config import settings

_LIVE = "https://api-m.paypal.com"
_SANDBOX = "https://api-m.sandbox.paypal.com"
_PREFER = {"Prefer": "return=representation"}


def base() -> str:
    return _LIVE if settings.paypal_mode == "live" else _SANDBOX


def configured() -> bool:
    return bool(settings.paypal_client_id and settings.paypal_client_secret)


def _token() -> str:
    if not configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "PayPal no configurado (PAYPAL_CLIENT_ID/SECRET)")
    r = httpx.post(
        f"{base()}/v1/oauth2/token",
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
        data={"grant_type": "client_credentials"},
        timeout=15.0,
    )
    _raise(r)
    return r.json()["access_token"]


def generate_client_token(customer_id: str | None = None) -> dict:
    """POST /v1/identity/generate-token: clientToken para Web SDK v6 (corta vida)."""
    if not configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "PayPal no configurado")
    body: dict = {}
    if customer_id:
        body["customer_id"] = customer_id
    r = httpx.post(
        f"{base()}/v1/identity/generate-token",
        headers={"Authorization": f"Bearer {_token()}", "Content-Type": "application/json",
                 "Accept-Language": "es-CO"},
        json=body,
        timeout=15.0,
    )
    _raise(r)
    return r.json()


def _raise(r: httpx.Response) -> None:
    if r.status_code >= 400:
        try:
            err = r.json()
            details = "; ".join(
                f"{d.get('field')}: {d.get('issue')}" for d in err.get("details", [])
            )
            msg = f"{err.get('name', 'ERROR')}: {err.get('message', '')}"
            if details:
                msg += f" [{details}]"
            msg += f" (debug_id={err.get('debug_id', '')})"
        except Exception:
            msg = f"PayPal {r.status_code}"
        raise HTTPException(status.HTTP_502_BAD_GATEWAY, msg)


def _money(value: str, currency: str) -> dict:
    """Valida monto positivo antes de llamar a PayPal (falla rápido con 400)."""
    try:
        amount = float(value)
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto inválido")
    if amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El monto debe ser positivo")
    return {"currency_code": currency, "value": value}


def _call(method: str, path: str, json: dict | None = None, prefer: bool = True) -> httpx.Response:
    headers = {"Authorization": f"Bearer {_token()}", "Content-Type": "application/json",
               "PayPal-Request-Id": str(uuid.uuid4())}  # idempotencia: clave nueva por intento (ventana 6h)
    if prefer and method in ("POST", "PATCH"):
        headers.update(_PREFER)
    r = httpx.request(method, f"{base()}{path}", headers=headers, json=json, timeout=20.0)
    _raise(r)
    return r


def _body(r: httpx.Response) -> dict:
    return {} if r.status_code == 204 else r.json()


def normalize_capture(data: dict) -> dict:
    """Normaliza una captura PayPal a nuestro libro, aceptando dos formas:
    directa {id, status, amount:{currency,value}} o anidada en orden
    (purchase_units[].payments.captures[0]). Retorna external_id, status,
    amount_cents y currency.
    """
    node = data
    try:
        node = data["purchase_units"][0]["payments"]["captures"][0]
    except (KeyError, IndexError, TypeError):
        pass
    amount = node.get("amount", {}) or {}
    currency = str(amount.get("currency_code") or amount.get("currency") or "USD")
    try:
        cents = int(round(float(str(amount.get("value", 0))) * 100))
    except (ValueError, TypeError):
        cents = 0
    return {
        "external_id": node.get("id") or data.get("id"),
        "status": str(node.get("status") or data.get("status") or "pending").lower(),
        "amount_cents": max(cents, 0),
        "currency": currency,
    }


# ---- Orders v2: ciclo de vida del pago ----
ITEM_CATEGORIES = ("PHYSICAL_GOODS", "DIGITAL_GOODS", "DONATION")
PROCESSING_INSTRUCTIONS = ("ORDER_COMPLETE_ON_PAYMENT_APPROVAL", "CAPTURE")


def _nonneg_money(value: str, currency: str) -> dict:
    """Monto >= 0 (campos del desglose admiten cero; _money exige positivo)."""
    try:
        v = float(str(value))
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto inválido")
    if v < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El monto no puede ser negativo")
    return {"currency_code": currency, "value": str(value)}


def _order_item(it: dict, currency: str) -> dict:
    category = it.get("category")
    if category and category not in ITEM_CATEGORIES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "category inválida (PHYSICAL_GOODS | DIGITAL_GOODS | DONATION)")
    node: dict = {"name": it["name"], "unit_amount": _money(str(it["unit_amount"]), currency),
                  "quantity": str(it.get("quantity", 1))}
    if it.get("description"):
        node["description"] = it["description"]
    if it.get("sku"):
        node["sku"] = it["sku"]
    if category:
        node["category"] = category
    if it.get("tax") is not None:
        node["tax"] = _nonneg_money(str(it["tax"]), currency)
    return node


def _order_breakdown(items: list, currency: str, amount: str, bd: dict) -> dict:
    """Desglose del monto con ítems: item_total = suma de ítems; valida que
    item_total + envío + manipulación + impuestos - descuento cuadre con el total."""
    def _f(key: str) -> float:
        try:
            return float(str(bd.get(key, "0") or "0"))
        except (ValueError, TypeError):
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"breakdown.{key} inválido")

    try:
        item_total = sum(int(it.get("quantity", 1)) * float(str(it["unit_amount"])) for it in items)
    except (ValueError, TypeError):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Ítems inválidos")
    shipping, handling = _f("shipping"), _f("handling")
    tax_total, discount = _f("tax_total"), _f("shipping_discount")
    esperado = item_total + shipping + handling + tax_total - discount
    if abs(esperado - float(amount)) > 0.005:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            f"El total ({amount}) no cuadra con ítems + envío + impuestos - descuento ({esperado:.2f})")
    return {
        "item_total": _nonneg_money(f"{item_total:.2f}", currency),
        "shipping": _nonneg_money(str(bd.get("shipping", "0") or "0"), currency),
        "handling": _nonneg_money(str(bd.get("handling", "0") or "0"), currency),
        "tax_total": _nonneg_money(str(bd.get("tax_total", "0") or "0"), currency),
        "shipping_discount": _nonneg_money(str(bd.get("shipping_discount", "0") or "0"), currency),
    }


def _order_shipping(s: dict) -> dict:
    if not s.get("address_line_1") or not s.get("country_code"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "shipping requiere address_line_1 y country_code")
    addr: dict = {"address_line_1": s["address_line_1"], "country_code": s["country_code"]}
    for key in ("address_line_2", "admin_area_2", "admin_area_1", "postal_code"):
        if s.get(key):
            addr[key] = s[key]
    out: dict = {"address": addr}
    if s.get("full_name"):
        out["name"] = {"full_name": s["full_name"]}
    return out


def create_order(amount: str, currency: str = "USD", intent: str = "CAPTURE",
                 return_url: str = "", cancel_url: str = "",
                 invoice_id: str | None = None, custom_id: str | None = None,
                 payment_method: str | None = None,
                 reference_id: str | None = None, description: str | None = None,
                 soft_descriptor: str | None = None,
                 processing_instruction: str | None = None,
                 items: list | None = None, shipping: dict | None = None,
                 breakdown: dict | None = None) -> dict:
    """POST /v2/checkout/orders. intent CAPTURE|AUTHORIZE (mayúsculas).

    payment_method: card | paypal | google_pay | apple_pay → payment_source
    (APMs: presenta solo los métodos que quieres ofrecer; None = todos los elegibles).

    Esquema completo opcional (carrito itemizado): ítems con categoría/sku/impuesto,
    desglose del monto (auto-validado contra el total), envío con dirección,
    reference_id/description/soft_descriptor y processing_instruction.
    """
    if intent not in ("CAPTURE", "AUTHORIZE"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, 'intent debe ser CAPTURE o AUTHORIZE')
    if payment_method is not None and payment_method not in ("card", "paypal", "google_pay", "apple_pay"):
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "payment_method inválido")
    if processing_instruction is not None and processing_instruction not in PROCESSING_INSTRUCTIONS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST,
                            "processing_instruction inválido (ORDER_COMPLETE_ON_PAYMENT_APPROVAL | CAPTURE)")
    money = _money(amount, currency)
    if items:
        money["breakdown"] = _order_breakdown(items, currency, amount, breakdown or {})
    unit: dict = {"amount": money}
    if reference_id:
        unit["reference_id"] = reference_id
    if description:
        unit["description"] = description
    if soft_descriptor:
        unit["soft_descriptor"] = soft_descriptor
    if invoice_id:
        unit["invoice_id"] = invoice_id
    if custom_id:
        unit["custom_id"] = custom_id
    if items:
        unit["items"] = [_order_item(it, currency) for it in items]
    if shipping:
        unit["shipping"] = _order_shipping(shipping)
    body: dict = {"intent": intent, "purchase_units": [unit]}
    if processing_instruction:
        body["processing_instruction"] = processing_instruction
    if payment_method:
        body["payment_source"] = {payment_method: {"experience_context": {
            "return_url": return_url or None, "cancel_url": cancel_url or None,
            "brand_name": "Cytech", "user_action": "PAY_NOW",
        }}}
    elif return_url or cancel_url:
        body["application_context"] = {"return_url": return_url, "cancel_url": cancel_url}
    data = _body(_call("POST", "/v2/checkout/orders", body))
    approve = next((l["href"] for l in data.get("links", []) if l.get("rel") == "approve"), "")
    return {"id": data.get("id"), "status": data.get("status"), "approve_url": approve}


# ---- Métodos de pago (APM) relevantes para Colombia ----
PAYMENT_METHODS: list[dict] = [
    {"id": "paypal", "label": "Billetera PayPal", "type": "monedero digital", "currencies": ["USD", "COP"], "note": "Cobertura mundial"},
    {"id": "card", "label": "Tarjetas Visa / Mastercard / Amex", "type": "tarjeta", "currencies": ["USD", "COP"], "note": "Débito y crédito"},
    {"id": "google_pay", "label": "Google Pay", "type": "monedero digital", "currencies": ["USD"], "note": "Directo, biométrico"},
    {"id": "apple_pay", "label": "Apple Pay", "type": "monedero digital", "currencies": ["USD"], "note": "Directo, biométrico"},
    {"id": "pay_later", "label": "Paga después", "type": "préstamo", "currencies": ["USD"], "note": "Disponibilidad por país"},
]


def get_order(order_id: str) -> dict:
    return _body(_call("GET", f"/v2/checkout/orders/{order_id}", prefer=False))


def capture_order(order_id: str) -> dict:
    """POST …/capture (sin payer_id; cuerpo {} si no hay cambios)."""
    return _body(_call("POST", f"/v2/checkout/orders/{order_id}/capture", {}))


def authorize_order(order_id: str) -> dict:
    return _body(_call("POST", f"/v2/checkout/orders/{order_id}/authorize", {}))


# ---- Payments v2: post-aprobación ----
def get_capture(capture_id: str) -> dict:
    return _body(_call("GET", f"/v2/payments/captures/{capture_id}", prefer=False))


def refund_capture(capture_id: str, amount: str | None = None, currency: str = "USD",
                   note_to_payer: str | None = None, custom_id: str | None = None) -> dict:
    """Reembolso total con cuerpo {} explícito; parcial con amount. Sin campo reason."""
    body: dict = {}
    if amount is not None:
        body["amount"] = _money(amount, currency)
    if note_to_payer:
        body["note_to_payer"] = note_to_payer
    if custom_id:
        body["custom_id"] = custom_id
    return _body(_call("POST", f"/v2/payments/captures/{capture_id}/refund", body))


def get_refund(refund_id: str) -> dict:
    return _body(_call("GET", f"/v2/payments/refunds/{refund_id}", prefer=False))


def get_authorization(auth_id: str) -> dict:
    return _body(_call("GET", f"/v2/payments/authorizations/{auth_id}", prefer=False))


def capture_authorization(auth_id: str, amount: str | None = None, currency: str = "USD",
                          final_capture: bool = True, invoice_id: str | None = None) -> dict:
    """final_capture explícito (default v2=false dejaría la autorización abierta)."""
    body: dict = {"final_capture": final_capture}
    if amount is not None:
        body["amount"] = _money(amount, currency)
    if invoice_id:
        body["invoice_id"] = invoice_id
    return _body(_call("POST", f"/v2/payments/authorizations/{auth_id}/capture", body))


def void_authorization(auth_id: str) -> dict:
    """204 por defecto; con Prefer retorna el recurso anulado."""
    return _body(_call("POST", f"/v2/payments/authorizations/{auth_id}/void", {}))


def reauthorize(auth_id: str, amount: str, currency: str = "USD") -> dict:
    """Solo acepta amount (sin fmf_details/processor_response)."""
    return _body(_call("POST", f"/v2/payments/authorizations/{auth_id}/reauthorize",
                       {"amount": _money(amount, currency)}))


# ---- Webhooks v2 (reemplazo de IPN) ----
def verify_webhook_signature(headers: dict, webhook_id: str, event: dict) -> bool:
    """POST /v1/notifications/verify-webhook-signature. Requiere PAYPAL_WEBHOOK_ID."""
    if not configured() or not settings.paypal_webhook_id:
        return False
    token = _token()
    r = httpx.post(
        f"{base()}/v1/notifications/verify-webhook-signature",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        json={
            "auth_algo": headers.get("paypal-auth-algo", ""),
            "cert_url": headers.get("paypal-cert-url", ""),
            "transmission_id": headers.get("paypal-transmission-id", ""),
            "transmission_sig": headers.get("paypal-transmission-sig", ""),
            "transmission_time": headers.get("paypal-transmission-time", ""),
            "webhook_id": webhook_id or settings.paypal_webhook_id,
            "webhook_event": event,
        },
        timeout=15.0,
    )
    _raise(r)
    return r.json().get("verification_status") == "SUCCESS"


# ---- Log in with PayPal (verificación de cuenta del usuario) ----
def login_authorize_url(redirect_uri: str, scope: str = "openid email", state: str = "") -> str:
    """URL para que el usuario inicie sesión en PayPal y autorice compartir su email."""
    if not settings.paypal_client_id:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "PayPal no configurado (PAYPAL_CLIENT_ID)")
    from urllib.parse import urlencode

    params = {"client_id": settings.paypal_client_id, "response_type": "code",
              "scope": scope, "redirect_uri": redirect_uri}
    if state:
        params["state"] = state
    return f"{base()}/v1/oauth2/authorize?{urlencode(params)}"


def exchange_code(code: str, redirect_uri: str) -> dict:
    if not configured():
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "PayPal no configurado")
    r = httpx.post(
        f"{base()}/v1/oauth2/token",
        auth=(settings.paypal_client_id, settings.paypal_client_secret),
        data={"grant_type": "authorization_code", "code": code, "redirect_uri": redirect_uri},
        timeout=15.0,
    )
    _raise(r)
    return r.json()


def userinfo_email(user_access_token: str) -> str:
    """Email verificado por PayPal (userinfo). Vacío si no lo expone."""
    r = httpx.get(
        f"{base()}/v1/identity/oauth2/userinfo?schema=paypalv1.1",
        headers={"Authorization": f"Bearer {user_access_token}", "Content-Type": "application/json"},
        timeout=15.0,
    )
    _raise(r)
    data = r.json()
    for e in data.get("emails", []):
        if e.get("primary"):
            return str(e.get("value", ""))
    return ""


# ---- Invoicing v2: facturas (create → send → seguimiento) ----
def invoice_create(payload: dict) -> dict:
    """POST /v2/invoicing/invoices: crea el borrador (201 + id de factura)."""
    return _body(_call("POST", "/v2/invoicing/invoices", payload))


def invoice_send(invoice_id: str, send_to_recipient: bool = True) -> dict:
    """POST …/send. Con send_to_recipient=false la factura queda en estado de
    pago SIN enviar correo: compartimos nosotros el link/QR hospedado."""
    return _body(_call("POST", f"/v2/invoicing/invoices/{invoice_id}/send",
                       {"send_to_recipient": send_to_recipient}))


def invoice_get(invoice_id: str) -> dict:
    """GET detalle: metadata.recipient_view_url es la página de pago hospedada."""
    return _body(_call("GET", f"/v2/invoicing/invoices/{invoice_id}", prefer=False))


def invoice_list(page: int = 1, page_size: int = 20) -> dict:
    return _body(_call("GET", f"/v2/invoicing/invoices?page={page}&page_size={page_size}", prefer=False))


def invoice_cancel(invoice_id: str) -> dict:
    """POST …/cancel: solo facturas enviadas; queda CANCELLED."""
    return _body(_call("POST", f"/v2/invoicing/invoices/{invoice_id}/cancel", {}))


def invoice_reminder(invoice_id: str) -> dict:
    """POST …/reminders: PayPal limita a 2 recordatorios/día por factura."""
    return _body(_call("POST", f"/v2/invoicing/invoices/{invoice_id}/reminders", {}))


def invoice_qr(invoice_id: str) -> dict:
    """POST …/qr-code (factura en SENT): PNG en base64 que abre la página de pago."""
    r = _call("POST", f"/v2/invoicing/invoices/{invoice_id}/qr-code?width=300&height=300", {})
    try:
        data = r.json()
    except ValueError:  # si alguna vez devuelve bytes PNG crudos
        import base64 as _b64
        return {"image": _b64.b64encode(r.content).decode()}
    if isinstance(data, dict) and not data.get("image"):
        data["image"] = data.get("qr_code") or data.get("data") or ""
    return data


def invoice_record_payment(invoice_id: str, amount: str, currency: str = "USD",
                           note: str = "") -> dict:
    """POST …/payments: registra un pago externo (transferencia/efectivo)
    → MARKED_AS_PAID / PARTIALLY_PAID sin pasar por PayPal."""
    body: dict = {"amount": _money(amount, currency)}
    if note:
        body["note"] = note
    return _body(_call("POST", f"/v2/invoicing/invoices/{invoice_id}/payments", body))


# ---- Transaction Search (reemplazo de List Payments v1) ----
def search_transactions(start_date: str, end_date: str, page_size: int = 20, page: int = 1) -> dict:
    """GET /v1/reporting/transactions. Sin equivalente de listado en Orders/Payments v2."""
    token = _token()
    r = httpx.get(
        f"{base()}/v1/reporting/transactions",
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
        params={"start_date": start_date, "end_date": end_date, "page_size": page_size, "page": page,
                "fields": "all", "transaction_status": "S"},
        timeout=20.0,
    )
    _raise(r)
    return r.json()
