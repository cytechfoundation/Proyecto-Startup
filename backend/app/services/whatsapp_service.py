"""WhatsApp Cloud API (Meta): parseo de mensajes y envío de respuestas."""
import httpx

from app.core.config import settings

_GRAPH = "https://graph.facebook.com/v21.0"


def parse_messages(payload: dict) -> list[dict]:
    """Extrae [{from, text, id}] de mensajes de texto válidos (ignora estados/otros)."""
    out = []
    if not isinstance(payload, dict) or payload.get("object") != "whatsapp_business_account":
        return out
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            for msg in (change.get("value", {}) or {}).get("messages", []):
                body = (msg.get("text") or {}).get("body")
                if msg.get("from") and body:
                    out.append({"from": msg["from"], "text": body, "id": msg.get("id", "")})
    return out


def send_text(to: str, text: str) -> dict:
    """Envía texto vía Cloud API. Exige token y phone_number_id configurados."""
    if not settings.whatsapp_token or not settings.whatsapp_phone_number_id:
        raise RuntimeError("WhatsApp no configurado (WHATSAPP_TOKEN/PHONE_NUMBER_ID)")
    r = httpx.post(
        f"{_GRAPH}/{settings.whatsapp_phone_number_id}/messages",
        headers={"Authorization": f"Bearer {settings.whatsapp_token}", "Content-Type": "application/json"},
        json={"messaging_product": "whatsapp", "to": to, "type": "text", "text": {"body": text[:4000]}},
        timeout=15.0,
    )
    r.raise_for_status()
    return r.json()
