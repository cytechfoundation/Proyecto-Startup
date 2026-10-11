"""Cliente DIAN (contrato listo; emisión real exige proveedor autorizado).

En desarrollo emite documentos simulados con CUFE de prueba para no bloquear
el flujo POS → factura → conciliación. En producción, implementar aquí el
envío al proveedor tecnológico con sus credenciales.
"""
import hashlib
import uuid
from datetime import datetime, timezone


def emit_document(kind: str, number: str, total_cents: int, customer_email: str) -> dict:
    seed = f"{kind}|{number}|{total_cents}|{customer_email}|{datetime.now(timezone.utc).isoformat()}"
    cufe = hashlib.sha256(seed.encode()).hexdigest().upper()
    return {
        "cufe": cufe,
        "document_id": f"{kind}-{number}-{uuid.uuid4().hex[:6]}",
        "status": "accepted",
        "mode": "stub",
        "note": "Emisión simulada: conectar proveedor DIAN autorizado en producción.",
    }
