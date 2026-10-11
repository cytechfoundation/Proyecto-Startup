"""Directorio de Usuarios: búsqueda, filtros, paginación y gestión de rol/estado. Solo admin."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import PaginatedUsersOut, RoleUpdateIn, StatusUpdateIn, UserOut

router = APIRouter(prefix="/users", tags=["users"])


@router.get("", response_model=PaginatedUsersOut)
def list_users(
    q: str | None = Query(default=None, description="Busca en nombre o correo"),
    domain: str | None = Query(default=None, description="Filtra por dominio, ej. cytech.com"),
    role: str | None = Query(default=None, description="admin | editor | client"),
    status_: str | None = Query(default=None, alias="status", description="active | inactive"),
    page: int = Query(default=1, ge=1, description="Página (desde 1)"),
    page_size: int = Query(default=10, ge=1, le=100, description="Registros por página"),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(User.name.ilike(like), User.email.ilike(like)))
    if domain:
        stmt = stmt.where(User.email.ilike(f"%@{domain.strip().lstrip('@')}"))
    if role:
        stmt = stmt.where(User.role == role)
    if status_:
        stmt = stmt.where(User.status == status_)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    pages = max((total + page_size - 1) // page_size, 1)
    page = min(page, pages)
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedUsersOut(
        items=[UserOut.model_validate(u) for u in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )


@router.put("/{user_id}/role", response_model=UserOut)
def update_role(user_id: str, body: RoleUpdateIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    user.role = body.role
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)


@router.patch("/{user_id}/status", response_model=UserOut)
def update_status(user_id: str, body: StatusUpdateIn, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    user = db.get(User, user_id)
    if user is None:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuario no encontrado")
    user.status = body.status
    db.commit()
    db.refresh(user)
    return UserOut.model_validate(user)
