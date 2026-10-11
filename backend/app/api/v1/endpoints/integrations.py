"""Mis integraciones: vinculación real por usuario (PayPal con cuenta, POS/DIAN directas)."""
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import HTMLResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.models.user_integration import UserIntegration
from app.schemas.user import IntegrationConnectIn, IntegrationOut
from app.services import paypal_service

router = APIRouter(prefix="/integrations", tags=["integrations"])

PROVIDERS = ("paypal", "pos", "dian")
ACCOUNT_REQUIRED = ("paypal",)  # exige correo de cuenta para vincular


@router.get("", response_model=list[IntegrationOut])
def list_mine(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = {r.provider: r for r in db.scalars(select(UserIntegration).where(UserIntegration.user_id == current.id)).all()}
    return [
        IntegrationOut(
            provider=p,
            connected=p in rows,
            account=rows[p].account if p in rows else None,
            verified=rows[p].verified if p in rows else False,
        )
        for p in PROVIDERS
    ]


@router.get("/paypal/config")
def paypal_config(_: User = Depends(get_current_user)):
    """Datos públicos para el SDK de PayPal (nunca expone el secret)."""
    return {
        "provider": "paypal",
        "mode": settings.paypal_mode,
        "client_id_configured": bool(settings.paypal_client_id),
    }


@router.post("/{provider}", response_model=IntegrationOut)
def connect(
    provider: str,
    body: IntegrationConnectIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if provider not in PROVIDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Proveedor inválido (paypal|pos|dian)")
    account = (body.account or "").strip() or None
    if provider in ACCOUNT_REQUIRED and not account:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "PayPal exige el correo de tu cuenta")
    row = db.scalar(
        select(UserIntegration).where(UserIntegration.user_id == current.id, UserIntegration.provider == provider)
    )
    if row is None:
        row = UserIntegration(user_id=current.id, provider=provider, account=account, verified=False)
        db.add(row)
    else:
        if row.account != account:
            row.verified = False  # cambió el correo: pierde la verificación
        row.account = account
        row.status = "connected"
    db.commit()
    db.refresh(row)
    return IntegrationOut(provider=provider, connected=True, account=row.account, verified=row.verified)


@router.delete("/{provider}", status_code=204)
def disconnect(provider: str, current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    if provider not in PROVIDERS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Proveedor inválido (paypal|pos|dian)")
    row = db.scalar(
        select(UserIntegration).where(UserIntegration.user_id == current.id, UserIntegration.provider == provider)
    )
    if row is not None:
        db.delete(row)
        db.commit()
    return None


@router.get("/all")
def list_all_admin(_: User = Depends(require_admin), db: Session = Depends(get_db)):
    """Auditoría admin: todas las integraciones vinculadas con su usuario."""
    rows = db.execute(
        select(UserIntegration, User.email, User.name)
        .join(User, User.id == UserIntegration.user_id)
        .order_by(UserIntegration.provider)
    ).all()
    return [
        {"user_email": email, "user_name": name, "provider": r.provider,
         "account": r.account, "verified": r.verified, "updated_at": r.updated_at}
        for r, email, name in rows
    ]


@router.get("/paypal/authorize")
def paypal_authorize(current: User = Depends(get_current_user)):
    """Inicia la verificación con PayPal: abre la URL en nueva pestaña e inicia sesión."""
    url = paypal_service.login_authorize_url(settings.paypal_identity_redirect_uri, state=current.id)
    return {"authorize_url": url}


@router.get("/paypal/callback")
def paypal_callback(
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    db: Session = Depends(get_db),
):
    """PayPal redirige aquí tras el login: canjea el code y marca la cuenta como verificada."""
    if error or not code or not state:
        return HTMLResponse("<h3>Verificación cancelada. Cierra esta pestaña.</h3>", status_code=400)
    try:
        tokens = paypal_service.exchange_code(code, settings.paypal_identity_redirect_uri)
        email = paypal_service.userinfo_email(tokens["access_token"])
    except HTTPException as e:
        return HTMLResponse(f"<h3>PayPal falló ({e.status_code}). Cierra esta pestaña.</h3>", status_code=502)
    if not email:
        return HTMLResponse("<h3>PayPal no expuso tu correo. Cierra esta pestaña.</h3>", status_code=400)
    user = db.get(User, state)
    if user is None:
        return HTMLResponse("<h3>Sesión inválida. Cierra esta pestaña.</h3>", status_code=400)
    row = db.scalar(
        select(UserIntegration).where(UserIntegration.user_id == user.id, UserIntegration.provider == "paypal")
    )
    if row is None:
        row = UserIntegration(user_id=user.id, provider="paypal", account=email.lower(), verified=True)
        db.add(row)
    else:
        row.account = email.lower()
        row.verified = True
        row.status = "connected"
    db.commit()
    return HTMLResponse(
        f"<h3>✓ Cuenta PayPal verificada ({email}). Cierra esta pestaña y recarga Mis integraciones.</h3>"
    )
