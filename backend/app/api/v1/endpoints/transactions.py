"""Libro transaccional: el usuario ve las suyas, el admin ve todo."""
import json

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.rbac import RequirePermission
from app.core.security import get_current_user
from app.db.session import get_db
from app.models.transaction import Transaction
from app.models.user import User
from app.schemas.user import PaginatedTransactionsOut, TransactionIn, TransactionOut
from app.services import dian_service

router = APIRouter(prefix="/transactions", tags=["transactions"])

KINDS = ("invoice", "payment", "refund")
PERM_BY_KIND = {"invoice": ("dian", "create"), "payment": ("payments", "manage"), "refund": ("payments", "manage")}


@router.get("", response_model=PaginatedTransactionsOut)
def list_mine(
    kind: str | None = Query(default=None),
    status_: str | None = Query(default=None, alias="status"),
    all_: bool = Query(default=False, alias="all", description="Solo admin: ver todas"),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    stmt = select(Transaction).order_by(Transaction.created_at.desc())
    if not (all_ and current.role == "admin"):
        stmt = stmt.where(Transaction.user_id == current.id)
    if kind:
        stmt = stmt.where(Transaction.kind == kind)
    if status_:
        stmt = stmt.where(Transaction.status == status_)
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    pages = max((total + page_size - 1) // page_size, 1)
    page = min(page, pages)
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedTransactionsOut(
        items=[TransactionOut.model_validate(t) for t in items],
        total=total, page=page, page_size=page_size, pages=pages,
    )


@router.post("", response_model=TransactionOut, status_code=201)
def register(
    body: TransactionIn,
    current: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Registra factura/pago/reembolso aplicando la matriz RBAC según el tipo."""
    if body.kind not in KINDS:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "kind inválido")
    gate = RequirePermission(*PERM_BY_KIND[body.kind])
    gate(current, db)  # 403 si el rol no puede
    if body.amount < 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto inválido")

    external_id, tx_status = body.external_id, "pending"
    if body.kind == "invoice":
        emit = dian_service.emit_document("FV", body.external_id or "AUTO", body.amount, current.email)
        external_id, tx_status = emit["document_id"], "accepted"

    tx = Transaction(
        user_id=current.id, provider=body.provider, kind=body.kind,
        amount=body.amount, currency=body.currency,
        status=tx_status, external_id=external_id,
        payload=json.dumps(body.payload or {}),
    )
    db.add(tx)
    db.commit()
    db.refresh(tx)
    return TransactionOut.model_validate(tx)
