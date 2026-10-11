"""Matriz RBAC persistida: el admin la edita desde el Dashboard y el backend la aplica.

DEFAULT_MATRIX es la semilla inicial; los interruptores guardan overrides en
la tabla role_permissions. Fuente única: GET /api/v1/rbac/matrix.
"""
from fastapi import Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import get_current_user
from app.db.session import get_db
from app.models.role_permission import RolePermission
from app.models.user import User

ROLES: list[str] = ["admin", "editor", "client"]

# Recurso → acción → roles con permiso (valores iniciales).
DEFAULT_MATRIX: dict[str, dict[str, list[str]]] = {
    "pos": {
        "view": ["admin", "editor"],
        "create": ["admin"],
        "edit": ["admin", "editor"],
        "delete": ["admin"],
    },
    "dian": {
        "view": ["admin", "editor", "client"],
        "create": ["admin", "editor"],
        "download": ["admin", "client"],
        "delete": ["admin"],
    },
    "payments": {
        "view": ["admin", "editor"],
        "manage": ["admin"],
    },
}

# Etiquetas legibles para la Matriz del Dashboard.
LABELS: dict[str, str] = {
    "pos": "Módulo POS / APIs",
    "dian": "Reportes DIAN",
    "payments": "Logs de Pago",
    "view": "Ver",
    "create": "Crear",
    "edit": "Editar",
    "delete": "Eliminar",
    "download": "Descargar",
    "manage": "Control total",
}


def get_matrix(db: Session) -> dict[str, dict[str, list[str]]]:
    """Matriz efectiva: semilla + overrides guardados (crea celdas faltantes)."""
    matrix: dict[str, dict[str, list[str]]] = {
        res: {act: list(roles) for act, roles in acts.items()} for res, acts in DEFAULT_MATRIX.items()
    }
    for perm in db.scalars(select(RolePermission)).all():
        cell = matrix.setdefault(perm.resource, {}).setdefault(perm.action, [])
        if perm.allowed and perm.role not in cell:
            cell.append(perm.role)
        elif not perm.allowed and perm.role in cell:
            cell.remove(perm.role)
    return matrix


def is_allowed(role: str, resource: str, action: str, db: Session | None = None) -> bool:
    """Chequeo estático (sin BD, tests) o efectivo contra la BD."""
    if db is None:
        return role in DEFAULT_MATRIX.get(resource, {}).get(action, [])
    return role in get_matrix(db).get(resource, {}).get(action, [])


def set_permission(db: Session, resource: str, action: str, role: str, allowed: bool) -> None:
    if role not in ROLES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Rol inválido")
    if resource not in DEFAULT_MATRIX or action not in DEFAULT_MATRIX[resource]:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Recurso/acción inválidos")
    perm = db.scalar(
        select(RolePermission).where(
            RolePermission.resource == resource,
            RolePermission.action == action,
            RolePermission.role == role,
        )
    )
    default = role in DEFAULT_MATRIX[resource][action]
    if allowed == default:
        if perm is not None:  # vuelve al valor de fábrica: borra el override
            db.delete(perm)
            db.commit()
        return
    if perm is None:
        perm = RolePermission(resource=resource, action=action, role=role, allowed=allowed)
        db.add(perm)
    else:
        perm.allowed = allowed
    db.commit()


class RequirePermission:
    """Dependencia FastAPI: Identificación (federada) + Autorización (matriz efectiva).

    Uso: Depends(RequirePermission("dian", "create"))
    """

    def __init__(self, resource: str, action: str):
        self.resource = resource
        self.action = action

    def __call__(
        self,
        current: User = Depends(get_current_user),
        db: Session = Depends(get_db),
    ) -> User:
        if not is_allowed(current.role, self.resource, self.action, db):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu rol no tiene permisos para administrar o ver este contenido.",
            )
        return current
