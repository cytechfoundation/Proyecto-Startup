"""Motor de Contenidos: verificación en 2 pasos (federada + matriz RBAC).

Cada endpoint declara su permiso vía Depends(RequirePermission(recurso, acción)):
1. Identificación obligatoria (JWT post-login federado).
2. Autorización contra la matriz antes de responder (milisegundos, sin I/O extra).
"""
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.rbac import LABELS, ROLES, RequirePermission, get_matrix, set_permission
from app.core.security import get_current_user, require_admin
from app.db.session import get_db
from app.models.user import User
from app.schemas.user import PermissionUpdateIn

router = APIRouter(tags=["content"])


@router.get("/rbac/matrix")
def read_matrix(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    """Expone la matriz efectiva para renderizarla en el Dashboard (única fuente de verdad)."""
    return {"roles": ROLES, "matrix": get_matrix(db), "labels": LABELS}


@router.put("/rbac/matrix")
def update_matrix(
    body: PermissionUpdateIn,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    """Activa/desactiva un interruptor de la matriz (solo Administrador). Aplica de inmediato."""
    set_permission(db, body.resource, body.action, body.role, body.allowed)
    return {"roles": ROLES, "matrix": get_matrix(db), "labels": LABELS}


content = APIRouter(prefix="/content", tags=["content"])


@content.get("/pos")
def view_pos(_: User = Depends(RequirePermission("pos", "view"))):
    return {"resource": "pos", "routes": ["pos/ventas", "pos/inventario"], "mode": "read"}


@content.post("/pos/routes")
def create_pos_route(_: User = Depends(RequirePermission("pos", "create"))):
    return {"status": "Ruta POS creada"}


@content.put("/pos/routes/{route_id}")
def edit_pos_route(route_id: str, _: User = Depends(RequirePermission("pos", "edit"))):
    return {"status": f"Ruta POS {route_id} actualizada"}


@content.get("/dian")
def view_dian(_: User = Depends(RequirePermission("dian", "view"))):
    return {"resource": "dian", "reports": [], "mode": "read"}


@content.post("/dian")
def crear_reporte_dian(_: User = Depends(RequirePermission("dian", "create"))):
    return {"status": "Reporte enviado a la DIAN con éxito"}


@content.delete("/dian/{report_id}")
def eliminar_reporte_dian(report_id: str, _: User = Depends(RequirePermission("dian", "delete"))):
    return {"status": f"Reporte {report_id} eliminado permanentemente"}


@content.get("/payments")
def view_payments(_: User = Depends(RequirePermission("payments", "view"))):
    return {"resource": "payments", "transactions": [], "mode": "read"}


@content.post("/payments/refund")
def refund_payment(_: User = Depends(RequirePermission("payments", "manage"))):
    return {"status": "Devolución ejecutada (control total)"}


router.include_router(content)
