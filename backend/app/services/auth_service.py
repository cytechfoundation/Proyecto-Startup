"""Núcleo de autenticación.

- Federada: valida criptográficamente el token del IdP (Google: JWKS/aud/iss/exp;
  GitHub: token activo) y autocrea el usuario si el email no existe.
- Local: alta con email+password en POST /auth/register (provider "local"),
  verificada con PBKDF2 en `verify_password`.
- Rol automático en ambos caminos: *@cytech.com → admin, resto → client.
"""
import hashlib
import hmac
import re
import secrets
from dataclasses import dataclass

import httpx
from fastapi import HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.user import User
from app.services import events

_GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs"
_GOOGLE_ISSUERS = {"https://accounts.google.com", "accounts.google.com"}

_jwks_cache: dict = {}


@dataclass(frozen=True)
class FederatedIdentity:
    email: str
    name: str
    provider: str


def resolve_role(email: str) -> str:
    """Regla corporativa: dominio @cytech.com → admin, si no → client."""
    domain = email.rsplit("@", 1)[-1].lower().strip()
    return "admin" if domain == settings.admin_domain.lower() else "client"


# --- Contraseñas (solo cuentas locales) -------------------------------------
# PBKDF2-HMAC-SHA256 con 600k iteraciones (recomendación OWASP 2023).
# Sin dependencias externas: hashlib de la stdlib.
_PBKDF2_ITERATIONS = 600_000


def password_policy_errors(password: str) -> list[str]:
    """Política de contraseña: ≥8 caracteres, una mayúscula y un dígito."""
    errors: list[str] = []
    if len(password) < 8:
        errors.append("al menos 8 caracteres")
    if not re.search(r"[A-Z]", password):
        errors.append("al menos una mayúscula")
    if not re.search(r"\d", password):
        errors.append("al menos un dígito")
    return errors


def hash_password(password: str) -> str:
    """Devuelve `pbkdf2_sha256$<iteraciones>$<salt_hex>$<hash_hex>`."""
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, _PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${_PBKDF2_ITERATIONS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    """Comprobación constante en tiempo de un hash almacenado (o None → False)."""
    if not stored:
        return False
    try:
        algo, iterations, salt_hex, digest_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iterations)
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def _google_jwks() -> dict:
    if not _jwks_cache:
        resp = httpx.get(_GOOGLE_JWKS_URL, timeout=10.0)
        resp.raise_for_status()
        _jwks_cache.update(resp.json())
    return _jwks_cache


def verify_google_id_token(id_token: str) -> FederatedIdentity:
    """Validación criptográfica del JWT de Google (firma RS256, aud, iss, exp)."""
    if not settings.google_client_id:
        raise HTTPException(status.HTTP_500_INTERNAL_SERVER_ERROR, "GOOGLE_CLIENT_ID no configurado")
    try:
        header = jwt.get_unverified_header(id_token)
        key = next(k for k in _google_jwks()["keys"] if k["kid"] == header.get("kid"))
        claims = jwt.decode(
            id_token,
            key,
            algorithms=["RS256"],
            audience=settings.google_client_id,
            issuer=_GOOGLE_ISSUERS,
            options={"verify_at_hash": False},
        )
    except (JWTError, StopIteration, KeyError) as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Token Google inválido: {e}")
    if not claims.get("email_verified", False):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Email de Google no verificado")
    email = str(claims.get("email", "")).lower().strip()
    if not email:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token sin email")
    return FederatedIdentity(email=email, name=str(claims.get("name", "")), provider="google")


def verify_github_access_token(access_token: str) -> FederatedIdentity:
    """GitHub no emite JWT: se valida el access_token contra api.github.com."""
    headers = {"Authorization": f"Bearer {access_token}", "Accept": "application/vnd.github+json"}
    try:
        user = httpx.get("https://api.github.com/user", headers=headers, timeout=10.0)
        if user.status_code != 200:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Token GitHub inválido")
        profile = user.json()
        email: str | None = profile.get("email")
        if not email:
            emails = httpx.get("https://api.github.com/user/emails", headers=headers, timeout=10.0)
            if emails.status_code == 200:
                primaries = [e["email"] for e in emails.json() if e.get("primary") and e.get("verified")]
                email = primaries[0] if primaries else None
        if not email:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "GitHub no expuso email verificado")
        name = profile.get("name") or profile.get("login", "")
        return FederatedIdentity(email=email.lower().strip(), name=str(name), provider="github")
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"IdP GitHub inalcanzable: {e}")


def verify_federated_credential(provider: str, credential: str) -> FederatedIdentity:
    if provider == "google":
        return verify_google_id_token(credential)
    if provider == "github":
        return verify_github_access_token(credential)
    raise HTTPException(status.HTTP_400_BAD_REQUEST, "Proveedor no soportado (google|github)")


def get_or_create_user(db: Session, identity: FederatedIdentity) -> tuple[User, bool]:
    """Autocreación federada. El único alta manual con contraseña es /auth/register."""
    from datetime import datetime, timezone

    existing = db.scalar(select(User).where(User.email == identity.email))
    if existing:
        # Auditoría: registra el último login federado.
        existing.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(existing)
        return existing, False
    user = User(
        email=identity.email,
        name=identity.name or identity.email,
        provider=identity.provider,
        role=resolve_role(identity.email),  # ← regla @cytech.com
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    events.publish("cytech.users.registered", {"email": user.email, "name": user.name, "role": user.role})
    return user, True
