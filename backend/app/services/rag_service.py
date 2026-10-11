"""RAG de Cytech: indexación en caliente + recuperación semántica/keywords + respuesta.

Sin OPENROUTER_API_KEY el sistema sigue respondiendo en modo extractivo
(fragmentos relevantes), y se mejora solo al configurar la key.
"""
import json
import math
import re
from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.knowledge import KnowledgeDoc
from app.services import llm_service

SYSTEM = (
    "Eres el asistente virtual oficial de Cytech. Responde en español, de forma breve y "
    "corporativa, usando EXCLUSIVAMENTE el contexto RAG proporcionado. Si el contexto no "
    "contiene la respuesta, dilo y ofrece contactar a cytechfoundation@gmail.com."
)

_WORD = re.compile(r"[a-záéíóúñü]{3,}")


def _tokens(text: str) -> set[str]:
    return set(_WORD.findall(text.lower()))


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a)) or 1.0
    nb = math.sqrt(sum(x * x for x in b)) or 1.0
    return dot / (na * nb)


@dataclass
class Hit:
    title: str
    content: str
    score: float


def add_document(db: Session, title: str, content: str, source: str = "corporate") -> KnowledgeDoc:
    """Inyección en caliente: guarda el doc y su embedding (si hay key)."""
    emb = llm_service.embed(f"{title}\n{content}")
    doc = KnowledgeDoc(
        title=title.strip(),
        content=content.strip(),
        source=source,
        embedding=json.dumps(emb) if emb else None,
    )
    db.add(doc)
    db.commit()
    db.refresh(doc)
    return doc


def retrieve(db: Session, question: str, k: int = 2) -> list[Hit]:
    """Top-k por similitud semántica (embeddings) o solape de keywords (sin key)."""
    docs = db.scalars(select(KnowledgeDoc)).all()
    if not docs:
        return []
    q_emb = llm_service.embed(question)
    scored: list[Hit] = []
    if q_emb:
        for d in docs:
            if not d.embedding:
                continue
            scored.append(Hit(d.title, d.content, _cosine(q_emb, json.loads(d.embedding))))
    if not scored:  # fallback extractivo
        qt = _tokens(question)
        for d in docs:
            dt = _tokens(f"{d.title} {d.content}")
            overlap = len(qt & dt) / max(len(qt), 1)
            scored.append(Hit(d.title, d.content, overlap))
    scored.sort(key=lambda h: h.score, reverse=True)
    return [h for h in scored[:k] if h.score > 0]


def answer(db: Session, question: str) -> dict:
    """CONSULTA_GENERAL: recupera contexto y genera respuesta (LLM o extractiva)."""
    hits = retrieve(db, question)
    if not hits:
        return {"reply": "Aún no tengo información sobre eso. Escríbenos a cytechfoundation@gmail.com.", "sources": []}
    context = "\n".join(f"[{h.title}] {h.content}" for h in hits)
    try:
        reply = llm_service.chat(SYSTEM, f"Contexto RAG:\n{context}\n\nPregunta: {question}")
        mode = "rag+llm"
    except Exception:
        reply = f"Según nuestra base: {hits[0].content[:400]}"
        mode = "rag-extractivo"
    return {"reply": reply, "sources": [h.title for h in hits], "mode": mode}
