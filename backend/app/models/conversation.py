"""Conversaciones del agente IA (sesiones multiturno por canal).

Una fila por sesión: `external_id` identifica al usuario en el canal
(uuid de sesión en web, número de teléfono en WhatsApp). Guarda el flujo
activo, el paso actual, los datos ya capturados (slots) y el historial.
"""
import json
import uuid
from datetime import datetime, timezone

from sqlalchemy import DateTime, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base

HISTORY_MAX = 12  # turnos (usuario+bot) conservados por sesión


class Conversation(Base):
    __tablename__ = "conversations"
    __table_args__ = (UniqueConstraint("channel", "external_id", name="uq_conversations_channel_ext"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    channel: Mapped[str] = mapped_column(String(20), nullable=False, default="web", index=True)
    external_id: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    flow: Mapped[str | None] = mapped_column(String(40), nullable=True)   # subscribe|contact|tax
    step: Mapped[str | None] = mapped_column(String(40), nullable=True)   # paso actual del flujo
    slots: Mapped[str] = mapped_column(Text, nullable=False, default="{}")     # JSON de datos capturados
    history: Mapped[str] = mapped_column(Text, nullable=False, default="[]")   # JSON [{role,text,at}]
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc)
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc),
    )

    # --- helpers JSON -------------------------------------------------
    def get_slots(self) -> dict:
        try:
            return json.loads(self.slots or "{}")
        except json.JSONDecodeError:
            return {}

    def set_slots(self, data: dict) -> None:
        self.slots = json.dumps(data, ensure_ascii=False)

    def get_history(self) -> list[dict]:
        try:
            data = json.loads(self.history or "[]")
            return data if isinstance(data, list) else []
        except json.JSONDecodeError:
            return []

    def add_turn(self, role: str, text: str) -> None:
        hist = self.get_history() + [{"role": role, "text": text, "at": datetime.now(timezone.utc).isoformat()}]
        self.history = json.dumps(hist[-HISTORY_MAX:], ensure_ascii=False)
