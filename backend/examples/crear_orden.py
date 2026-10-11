"""Equivalente v2 del snippet clásico v1 con requests.

v1 (obsoleto):  POST /v1/payments/payment {"intent": "sale", ...} + POST .../execute
v2 (este file): POST /v2/checkout/orders {"intent": "CAPTURE", ...} + POST .../capture

Requiere PAYPAL_CLIENT_ID/SECRET en backend/.env (sandbox).
Uso:  cd backend && python examples/crear_orden.py
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services import paypal_service

order = paypal_service.create_order(
    "25.00",
    "USD",
    "CAPTURE",
    return_url="https://example.com/return",
    cancel_url="https://example.com/cancel",
    invoice_id="INV-001",
    custom_id="mi-referencia-interna",
)

if order.get("status") == "CREATED":
    print("Order created:", order["id"], "| aprueba aquí:", order["approve_url"])
    # Tras la aprobación del comprador (navegador), captura sin payer_id:
    # capture = paypal_service.capture_order(order["id"])
    # print("Capture:", capture.get("status"))
else:
    print("Error:", order)
