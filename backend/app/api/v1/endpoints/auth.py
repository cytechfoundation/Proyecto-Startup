"""Flujo OAuth2/OIDC: login (302) → callback (canje) → autocreación → JWT propio.

También expone el alta local con contraseña (POST /auth/register) y su login
(POST /auth/login); la sesión siempre termina en el mismo JWT propio.
"""
import secrets
from datetime import datetime, timezone
from urllib.parse import urlencode

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import create_access_token, get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import FederatedLoginIn, PasswordLoginIn, RegisterIn, TokenOut, UserOut
from app.services import events
from app.services.auth_service import (
    FederatedIdentity,
    get_or_create_user,
    hash_password,
    password_policy_errors,
    resolve_role,
    verify_federated_credential,
    verify_github_access_token,
    verify_google_id_token,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])


def _issue(user: User) -> TokenOut:
    return TokenOut(access_token=create_access_token(subject=str(user.id), role=user.role), user=UserOut.model_validate(user))


@router.get("/google/login")
def google_login() -> RedirectResponse:
    params = urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.google_redirect_uri,
            "response_type": "code",
            "scope": "openid email profile",
            "access_type": "offline",
            "prompt": "consent",
            "state": secrets.token_urlsafe(16),
        }
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/google/callback", response_class=RedirectResponse)
def google_callback(code: str, db: Session = Depends(get_db)):
    """Canjea `code` por tokens, valida el id_token y redirige al frontend con JWT propio."""
    try:
        r = httpx.post(
            "https://oauth2.googleapis.com/token",
            data={
                "code": code,
                "client_id": settings.google_client_id,
                "client_secret": settings.google_client_secret,
                "redirect_uri": settings.google_redirect_uri,
                "grant_type": "authorization_code",
            },
            timeout=10.0,
        )
        r.raise_for_status()
        id_token = r.json().get("id_token")
        if not id_token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Google no devolvió id_token")
        identity = verify_google_id_token(id_token)
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Fallo canje Google: {e}")
    user, _ = get_or_create_user(db, identity)
    issued = _issue(user)
    return RedirectResponse(f"{settings.frontend_url}/dashboard?token={issued.access_token}")


@router.get("/github/login")
def github_login() -> RedirectResponse:
    params = urlencode(
        {"client_id": settings.github_client_id, "redirect_uri": settings.github_redirect_uri, "scope": "read:user user:email"}
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/github/callback", response_class=RedirectResponse)
def github_callback(code: str, db: Session = Depends(get_db)):
    try:
        r = httpx.post(
            "https://github.com/login/oauth/access_token",
            headers={"Accept": "application/json"},
            data={"client_id": settings.github_client_id, "client_secret": settings.github_client_secret, "code": code,
                  "redirect_uri": settings.github_redirect_uri},
            timeout=10.0,
        )
        r.raise_for_status()
        access_token = r.json().get("access_token")
        if not access_token:
            raise HTTPException(status.HTTP_401_UNAUTHORIZED, "GitHub no devolvió access_token")
        identity: FederatedIdentity = verify_github_access_token(access_token)
    except httpx.HTTPError as e:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, f"Fallo canje GitHub: {e}")
    user, _ = get_or_create_user(db, identity)
    issued = _issue(user)
    return RedirectResponse(f"{settings.frontend_url}/dashboard?token={issued.access_token}")


@router.post("/federated", response_model=TokenOut)
def federated_login(body: FederatedLoginIn, db: Session = Depends(get_db)):
    """Login directo con credencial del IdP (Google One Tap / GIS). Sin registro manual."""
    identity = verify_federated_credential(body.provider, body.credential)
    user, _ = get_or_create_user(db, identity)
    return _issue(user)


@router.post("/register", response_model=TokenOut, status_code=status.HTTP_201_CREATED)
def register(body: RegisterIn, db: Session = Depends(get_db)):
    """Alta de cuenta con email+password (provider "local"). Emite JWT al instante."""
    email = body.email.lower().strip()
    name = body.name.strip()
    if not body.terms:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Debes aceptar los términos y la política de privacidad")
    policy = password_policy_errors(body.password)
    if policy:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Contraseña débil: requiere {', '.join(policy)}")
    if db.scalar(select(User).where(User.email == email)):
        raise HTTPException(status.HTTP_409_CONFLICT, "Ese email ya está registrado. Inicia sesión.")
    user = User(
        email=email,
        name=name or email,
        provider="local",
        role=resolve_role(email),  # ← misma regla @cytech.com que la vía federada
        password_hash=hash_password(body.password),
        terms_accepted_at=datetime.now(timezone.utc),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    events.publish("cytech.users.registered", {"email": user.email, "name": user.name, "role": user.role})
    return _issue(user)


@router.post("/login", response_model=TokenOut)
def password_login(body: PasswordLoginIn, db: Session = Depends(get_db)):
    """Login con email+password. Mensaje único si falla el email o la contraseña."""
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Credenciales inválidas")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuario inactivo")
    user.last_login_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(user)
    return _issue(user)


class DemoLoginIn(BaseModel):
    email: str


@router.post("/demo", response_model=TokenOut)
def demo_login(body: DemoLoginIn, db: Session = Depends(get_db)):
    """SOLO DESARROLLO: emite JWT para un usuario ya existente (ver seed_demo.py).

    No crea usuarios (respeta la regla anti-registro-manual) y se desactiva
    con DEMO_LOGIN_ENABLED=false en producción.
    """
    if not settings.demo_login_enabled:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "No disponible")
    user = db.scalar(select(User).where(User.email == body.email.lower().strip()))
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Ejecuta seed_demo.py primero")
    if user.status != "active":
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Usuario inactivo")
    return _issue(user)


@router.get("/me", response_model=UserOut)
def me(current: User = Depends(get_current_user)):
    return UserOut.model_validate(current)
