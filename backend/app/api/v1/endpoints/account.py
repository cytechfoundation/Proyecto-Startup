"""Mi cuenta: perfil propio y resumen (cualquier usuario federado activo)."""
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.rbac import get_matrix
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import DeleteConfirmIn, ProfileUpdateIn, TermsAcceptIn, UserOut

router = APIRouter(prefix="/account", tags=["account"])


@router.get("/summary")
def account_summary(current: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Panel de control: perfil + permisos derivados de la matriz efectiva + actividad."""
    permissions = [
        f"{resource}:{action}"
        for resource, actions in get_matrix(db).items()
        for action, roles in actions.items()
        if current.role in roles
    ]
    return {
        "user": UserOut.model_validate(current),
        "permissions": sorted(permissions),
        "member_since": current.created_at,
        "last_login": current.last_login_at,
    }


@router.put("/profile", response_model=UserOut)
def update_profile(
    body: ProfileUpdateIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """El usuario edita su propio perfil. Email/rol/estado los gobiernan IdP y admin."""
    user = db.get(User, current.id)
    if body.name is not None:
        user.name = body.name.strip() or user.name
    if body.company is not None:
        user.company = body.company.strip() or None
    if body.phone is not None:
        user.phone = body.phone.strip() or None
    if body.nit is not None:
        user.nit = body.nit.strip() or None
    if body.person_type is not None:
        user.person_type = body.person_type
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.put("/terms", response_model=UserOut)
def accept_terms(
    body: TermsAcceptIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Constancia de aceptación de Política + Términos (v1.0-oct2026)."""
    user = db.get(User, current.id)
    user.terms_accepted_at = datetime.now(timezone.utc) if body.accepted else None
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.delete("/me", status_code=204)
def delete_my_account(
    body: DeleteConfirmIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """El usuario elimina su propia cuenta confirmando su correo. Irreversible."""
    if body.email.lower().strip() != current.email.lower():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "El correo no coincide con tu cuenta")
    user = db.get(User, current.id)
    db.delete(user)
    db.commit()
    return None
