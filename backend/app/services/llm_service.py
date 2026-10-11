"""Cliente LLM/Embeddings vía OpenRouter (compatible OpenAI)."""
import httpx

from app.core.config import settings

_BASE = "https://openrouter.ai/api/v1"


def _headers() -> dict[str, str]:
    return {
        "Authorization": f"Bearer {settings.openrouter_api_key}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "Cytech Web",
    }


def configured() -> bool:
    return bool(settings.openrouter_api_key)


def chat(system: str, user: str, temperature: float = 0.2) -> str:
    """Completa un chat. Lanza RuntimeError si no hay key (el RAG degrada a extractivo)."""
    if not configured():
        raise RuntimeError("OPENROUTER_API_KEY no configurada")
    r = httpx.post(
        f"{_BASE}/chat/completions",
        headers=_headers(),
        json={
            "model": settings.openrouter_chat_model,
            "temperature": temperature,
            "messages": [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
        },
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()["choices"][0]["message"]["content"].strip()


def embed(text: str) -> list[float] | None:
    """Embedding del texto o None si no hay key (retrieval cae a keywords)."""
    if not configured():
        return None
    r = httpx.post(
        f"{_BASE}/embeddings",
        headers=_headers(),
        json={"model": settings.openrouter_embed_model, "input": text[:4000]},
        timeout=30.0,
    )
    r.raise_for_status()
    return r.json()["data"][0]["embedding"]
