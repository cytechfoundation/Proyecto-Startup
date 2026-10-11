"""Email transaccional: Resend en producción, log en desarrollo."""
import logging

import httpx

from app.core.config import settings

log = logging.getLogger("cytech.email")


def send(to: str, subject: str, body: str) -> dict[str, str]:
    """Envía o registra. Retorna canal usado (resend|log)."""
    if not settings.resend_api_key:
        log.warning("EMAIL[log] to=%s subject=%s body=%.120s", to, subject, body)
        return {"channel": "log", "to": to}
    r = httpx.post(
        "https://api.resend.com/emails",
        headers={"Authorization": f"Bearer {settings.resend_api_key}", "Content-Type": "application/json"},
        json={"from": "Cytech <hola@cytech.com>", "to": [to], "subject": subject, "text": body},
        timeout=15.0,
    )
    r.raise_for_status()
    return {"channel": "resend", "to": to, "id": r.json().get("id", "")}
