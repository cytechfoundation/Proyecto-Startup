"""Agente multiturno de Cytech: máquina de estados con slot-filling por sesión.

Diseño
------
* Cada sesión (`session_id`) mantiene una fila en `conversations` con el flujo
  activo, el paso actual y los datos ya capturados (slots). Así el agente puede
  preguntar "¿tu correo?" en un turno y recibirlo en el siguiente.
* Flujos guiados: `subscribe` (correo), `contact` (nombre -> correo -> mensaje)
  y `tax` (aclara impuesto/periodo y responde con RAG).
* Sin `session_id` el servicio es **stateless** y conserva el contrato histórico
  del endpoint (`suscribir: correo`, `noticia: ...`, consulta general RAG).
* `channel` permite separar sesiones de web y WhatsApp (mismo `external_id`
  no colisiona).
"""
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.conversation import Conversation
from app.models.lead import Lead
from app.models.subscriber import Subscriber
from app.services import email_service, events, rag_service

SUPPORT_EMAIL = "cytechfoundation@gmail.com"

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
NEWS_RE = re.compile(r"noticia\s*:\s*(?P<title>[^|]+)\|\s*(?P<content>.+)", re.IGNORECASE | re.DOTALL)
SUB_RE = re.compile(r"suscribir(?:me|se)?\s*:\s*(?P<email>\S+@\S+)", re.IGNORECASE)
CANCEL_RE = re.compile(
    r"\b(cancelar?|no,?\s*gracias|olv[ií]dalo|nada,\s*por\s*ahora|me\s*arrepent[ií]|me\s*equivoc[aá])\b",
    re.IGNORECASE,
)

FLOW_NAMES = {"subscribe": "suscripción", "contact": "contacto", "tax": "calendario tributario"}
SUGGESTIONS_IDLE = ["Suscribirme", "Contactar asesor", "Calendario tributario"]
SUGGESTIONS_FLOW = ["Cancelar"]

# ---------------------------------------------------------------- intenciones
# Detectadas solo cuando NO hay un flujo activo (en orden de prioridad).
FLOW_START = {
    "subscribe": re.compile(
        r"\b(suscribirme|suscribirse|subscribirme|quiero\s+suscribir|newsletter|bolet[ií]n)\b", re.IGNORECASE
    ),
    "contact": re.compile(
        r"\b(contactar?|contacto|asesor(?:a)?|hablar\s+con|comunicarme|llamar|soporte\s+humano|agendar)\b",
        re.IGNORECASE,
    ),
    "tax": re.compile(
        r"\b(calendario|tributario|obligaci[oó]n(?:es)?|impuesto|dian|declaraci[oó]n|retenciones|iva|renta)\b",
        re.IGNORECASE,
    ),
}

# ---------------------------------------------------------------- pasos
# "next": None => el flujo termina y se ejecuta su acción.
STEPS: dict[tuple[str, str], dict] = {
    ("subscribe", "email"): {
        "slot": "email",
        "prompt": "¡Genial! ¿A qué correo te suscribo? (ejemplo: ana@correo.com)",
        "validate": lambda v: bool(EMAIL_RE.search(v)),
        "extract": lambda v: (m.group(0) if (m := EMAIL_RE.search(v)) else v.strip()),
        "retry": "Ese correo no parece válido. Escríbelo así: ana@correo.com",
        "next": None,
    },
    ("contact", "name"): {
        "slot": "nombre",
        "prompt": "¡Con gusto! Un asesor de Cytech te contactará. ¿Cuál es tu nombre?",
        "validate": lambda v: len(v.strip()) >= 2,
        "extract": lambda v: v.strip(),
        "retry": "No leí bien tu nombre. ¿Me lo repites?",
        "next": "email",
    },
    ("contact", "email"): {
        "slot": "email",
        "prompt": "Gracias. ¿A qué correo te escribimos?",
        "validate": lambda v: bool(EMAIL_RE.search(v)),
        "extract": lambda v: (m.group(0) if (m := EMAIL_RE.search(v)) else v.strip()),
        "retry": "Ese correo no parece válido. Ejemplo: ana@correo.com",
        "next": "message",
    },
    ("contact", "message"): {
        "slot": "mensaje",
        "prompt": "Última cosa: cuéntame en una línea qué necesitas (facturación, calendario, RUT…).",
        "validate": lambda v: len(v.strip()) >= 3,
        "extract": lambda v: v.strip(),
        "retry": "Cuéntame un poco más (mínimo unas palabras).",
        "next": None,
    },
    ("tax", "scope"): {
        "slot": "scope",
        "prompt": "Sobre el calendario tributario DIAN: ¿qué impuesto o periodo te interesa? (ej. IVA, renta, retenciones, diciembre)",
        "validate": lambda v: len(v.strip()) >= 3,
        "extract": lambda v: v.strip(),
        "retry": "Necesito algo más específico: ¿IVA, renta, retenciones…?",
        "next": None,
    },
}

FLOW_ORDER = {"subscribe": ["email"], "contact": ["name", "email", "message"], "tax": ["scope"]}


# ---------------------------------------------------------------- utilidades
def _resp(intent: str, reply: str, *, success: bool = True, flow: str | None = None,
          step: str | None = None, suggestions: list[str] | None = None, **extra) -> dict:
    """Shape único de respuesta (compatible con el contrato histórico)."""
    return {
        "intent": intent,
        "success": success,
        "reply": reply,
        "flow": flow,
        "step": step,
        "suggestions": suggestions if suggestions is not None else (SUGGESTIONS_FLOW if flow else SUGGESTIONS_IDLE),
        **extra,
    }


def get_or_create_conversation(db: Session, external_id: str, channel: str = "web") -> Conversation:
    """Sesión por (canal, id_externo). WhatsApp usa el número; web, un uuid."""
    channel = (channel or "web").strip().lower()[:20]
    external_id = str(external_id).strip()[:120]
    conv = db.scalar(select(Conversation).where(
        Conversation.channel == channel, Conversation.external_id == external_id))
    if conv is None:
        conv = Conversation(channel=channel, external_id=external_id, slots="{}", history="[]")
        db.add(conv)
    return conv


def reset_conversation(db: Session, external_id: str, channel: str = "web") -> bool:
    """Borra el estado del diálogo (el widget lo logra generando un uuid nuevo)."""
    conv = db.scalar(select(Conversation).where(
        Conversation.channel == (channel or "web").strip().lower(),
        Conversation.external_id == str(external_id).strip()[:120]))
    if conv is None:
        return False
    db.delete(conv)
    db.commit()
    return True


def _finish(conv: Conversation) -> None:
    """Cierra el flujo conservando el historial."""
    conv.flow = None
    conv.step = None
    conv.set_slots({})


# ---------------------------------------------------------------- acciones
def subscribe_email(db: Session, email: str, message: str = "¡Suscripción confirmada!") -> dict:
    """Alta en el boletín + evento + email de confirmación (canal Resend o log)."""
    email = (email or "").strip().lower()
    existing = db.scalar(select(Subscriber).where(Subscriber.email == email))
    if existing is None:
        db.add(Subscriber(email=email))
        db.commit()
    events.publish("cytech.subscriptions.created", {"email": email})
    sent = email_service.send(email, "¡Suscripción confirmada! — Cytech", message)
    return {"intent": "RESPONDER_SUSCRIPCION", "success": True,
            "reply": f"Suscripción procesada y alerta enviada a {email} (canal: {sent['channel']})."}


def _contact(db: Session, slots: dict) -> dict:
    nombre = (slots.get("nombre") or "—").strip()[:200]
    email = (slots.get("email") or "-").strip()[:320]
    mensaje = (slots.get("mensaje") or "").strip()[:1000]
    db.add(Lead(nombre=nombre, apellidos="-", empresa="-", nit="-", cargo="-",
                email=email, telefono="-", ciudad="-", opcion="chat agente"))
    db.commit()
    events.publish("cytech.contact.requested", {"nombre": nombre, "email": email, "mensaje": mensaje})
    sent = email_service.send(
        SUPPORT_EMAIL,
        f"Nuevo contacto por chat: {nombre}",
        f"Nombre: {nombre}\nEmail: {email}\nMensaje: {mensaje}",
    )
    return {"intent": "CONTACTO_SOLICITADO", "success": True,
            "reply": f"¡Listo, {nombre}! Un asesor de Cytech te escribirá a {email} (canal: {sent['channel']}).",
            "lead": {"nombre": nombre, "email": email}}


def _tax_answer(db: Session, slots: dict, history: list[dict]) -> dict:
    scope = (slots.get("scope") or "").strip()
    result = rag_service.answer(db, f"{scope} (calendario tributario DIAN)", history=history)
    reply = f"{result['reply']}\n\n📅 Puedes ver todas las fechas en /calendario-tributario y suscribirte a tu calendario."
    return {"intent": "CALENDARIO_TRIBUTARIO", "success": True, "reply": reply,
            "sources": result.get("sources", [])}


def _complete(db: Session, flow: str, slots: dict, history: list[dict]) -> dict:
    if flow == "subscribe":
        return subscribe_email(db, slots.get("email", ""))
    if flow == "contact":
        return _contact(db, slots)
    return _tax_answer(db, slots, history)


# ---------------------------------------------------------------- máquina
def _advance(db: Session, conv: Conversation, text: str) -> dict:
    """Alimenta el paso activo del flujo con el turno del usuario."""
    step_def = STEPS[(conv.flow, conv.step)]
    flow, step = conv.flow, conv.step

    if not step_def["validate"](text):                    # dato inválido: repregunta
        reply = step_def["retry"]
        conv.add_turn("bot", reply)
        db.commit()
        return _resp("FLUJO_DATO_INVALIDO", reply, success=False, flow=flow, step=step)

    slots = conv.get_slots()
    slots[step_def["slot"]] = step_def["extract"](text)
    conv.set_slots(slots)

    nxt = step_def["next"]
    if nxt:                                               # siguiente pregunta
        conv.step = nxt
        reply = STEPS[(flow, nxt)]["prompt"]
        conv.add_turn("bot", reply)
        db.commit()
        return _resp("FLUJO_PASO", reply, flow=flow, step=nxt)

    result = _complete(db, flow, slots, conv.get_history())
    _finish(conv)
    conv.add_turn("bot", result["reply"])
    db.commit()
    return _resp(result["intent"], result["reply"], **{k: v for k, v in result.items()
                                                      if k not in ("intent", "success", "reply")})


def handle(db: Session, message: str, session_id: str | None = None, channel: str = "web") -> dict:
    """Punto de entrada del agente. Con `session_id` habla en varios turnos."""
    text = (message or "").strip()

    # --- sin sesión: contrato histórico intacto (stateless) --------------
    if not session_id:
        if m := NEWS_RE.search(text):
            return {"intent": "ACTUALIZAR_NOTICIA", "success": False,
                    "reply": "Solo un Administrador puede indexar noticias (usa el panel Base de conocimiento)."}
        if m := SUB_RE.search(text):
            return subscribe_email(db, m.group("email").strip())
        if "suscribir" in text.lower():
            return {"intent": "RESPONDER_SUSCRIPCION_AYUDA", "success": True,
                    "reply": "Para suscribirte escribe: suscribir: tu@correo.com"}
        result = rag_service.answer(db, text)
        return {"intent": "CONSULTA_GENERAL", "success": True, **result}

    # --- con sesión: diálogo con estado -----------------------------------
    conv = get_or_create_conversation(db, session_id, channel)
    conv.add_turn("user", text)

    if conv.flow:  # hay un flujo abierto: el turno es la respuesta al dato pedido
        if CANCEL_RE.search(text):
            name = FLOW_NAMES.get(conv.flow, conv.flow)
            _finish(conv)
            reply = f"Listo, cancelo el flujo de {name}. ¿En qué más puedo ayudarte?"
            conv.add_turn("bot", reply)
            db.commit()
            return _resp("CANCELAR", reply)
        return _advance(db, conv, text)

    if NEWS_RE.search(text):
        conv.add_turn("bot", "noticia bloqueada")
        db.commit()
        return {"intent": "ACTUALIZAR_NOTICIA", "success": False,
                "reply": "Solo un Administrador puede indexar noticias (usa el panel Base de conocimiento)."}

    if m := SUB_RE.search(text):  # suscripción completa en un turno
        result = subscribe_email(db, m.group("email").strip())
        conv.add_turn("bot", result["reply"])
        db.commit()
        return _resp(result["intent"], result["reply"])

    for flow, pattern in FLOW_START.items():  # ¿arrancamos un flujo guiado?
        if pattern.search(text):
            conv.flow = flow
            conv.step = FLOW_ORDER[flow][0]
            conv.set_slots({})
            reply = STEPS[(flow, conv.step)]["prompt"]
            conv.add_turn("bot", reply)
            db.commit()
            return _resp("FLUJO_PASO", reply, flow=flow, step=conv.step)

    result = rag_service.answer(db, text, history=conv.get_history())
    conv.add_turn("bot", result["reply"])
    db.commit()
    return {"intent": "CONSULTA_GENERAL", "success": True, "flow": None, "step": None,
            "suggestions": SUGGESTIONS_IDLE, **result}
