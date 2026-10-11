"""Intérprete de rechazos de tarjeta (AVS/CVV) de PayPal Checkout en español.

Fuente: guía /v5/expanded/card-decline-errors. Visa/Mastercard/Discover/Amex
usan códigos alfabéticos; Maestro, numéricos. El objeto `processor_response`
de Orders v2 trae estos valores cuando una tarjeta es rechazada.
"""

AVS_ALPHA = {
    "A": "Solo coincide la dirección (sin código postal).",
    "B": "Internacional: solo coincide la dirección.",
    "C": "Sin coincidencia. Transacción rechazada.",
    "D": "Internacional: coinciden dirección y código postal.",
    "E": "No permitido en comercio electrónico. Transacción rechazada.",
    "F": "Reino Unido: coinciden dirección y código postal.",
    "G": "Verificación global no disponible.",
    "I": "Verificación internacional no disponible.",
    "M": "Coinciden dirección y código postal.",
    "N": "Sin coincidencia. Transacción rechazada.",
    "P": "Solo coincide el código postal.",
    "R": "Reintentar la verificación.",
    "S": "Servicio no compatible.",
    "U": "Información no disponible.",
    "W": "Código postal de 9 dígitos (sin dirección).",
    "X": "Coincidencia exacta (dirección + ZIP 9 dígitos).",
    "Y": "Coinciden dirección y ZIP de 5 dígitos.",
    "Z": "Solo ZIP de 5 dígitos.",
}

CVV_ALPHA = {
    "E": "Error: respuesta no reconocida.",
    "I": "CVV inválido o nulo.",
    "M": "Coincide.",
    "N": "Sin coincidencia.",
    "P": "No procesado.",
    "S": "Servicio no compatible.",
    "U": "Emisor no certificado.",
    "X": "Sin respuesta del emisor.",
}

AVS_MAESTRO = {
    "0": "Toda la dirección coincide.",
    "1": "Nada coincide. Transacción rechazada.",
    "2": "Coincidencia parcial.",
    "3": "Comercio no envió datos AVS.",
    "U": "Dirección no verificada / adquirente sin respuesta.",
}

CVV_MAESTRO = {
    "0": "CVV coincide.",
    "1": "CVV sin coincidencia.",
    "2": "Comercio sin manejo de CVV2.",
    "3": "CVV2 declarado ausente.",
    "X": "Servicio no disponible.",
}

REJECT_AVS = {"C", "E", "N", "1"}
REJECT_CVV = {"N", "1"}


def interpret(avs_code: str | None = None, cvv_code: str | None = None,
              brand: str = "visa") -> dict:
    """Explica un rechazo. brand maestro → tablas numéricas."""
    maestro = brand.lower() in ("maestro",)
    avs_table = AVS_MAESTRO if maestro else AVS_ALPHA
    cvv_table = CVV_MAESTRO if maestro else CVV_ALPHA
    avs = (avs_code or "").strip().upper()
    cvv = (cvv_code or "").strip().upper()
    avs_info = avs_table.get(avs, "Código no documentado." if avs else "Sin dato AVS.")
    cvv_info = cvv_table.get(cvv, "Código no documentado." if cvv else "Sin dato CVV.")
    rejected = (avs in REJECT_AVS) or (cvv in REJECT_CVV)
    advice = (
        "Pide al comprador verificar dirección, código postal y CVV, o usar otro método."
        if rejected else
        "Verificación parcial: monitorea la transacción; considera reintentar o pedir otro método."
    )
    return {"brand": brand, "avs": {"code": avs or None, "meaning": avs_info},
            "cvv": {"code": cvv or None, "meaning": cvv_info},
            "rejected": rejected, "advice": advice}


def from_processor_response(pr: dict, brand: str = "visa") -> dict | None:
    """Extrae AVS/CVV de `processor_response` de Orders v2 y los interpreta."""
    if not isinstance(pr, dict) or not pr:
        return None
    return interpret(pr.get("avs_code"), pr.get("cvv_code"), brand)
