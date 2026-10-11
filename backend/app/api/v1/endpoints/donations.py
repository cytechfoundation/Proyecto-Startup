"""Donaciones: registro público de aportes + consulta admin."""
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.donation import Donation
from app.models.user import User
from app.schemas.user import DonationIn, DonationOut, PaginatedDonationsOut
from app.services import events

router = APIRouter(prefix="/donations", tags=["donations"])

CAUSES = ("becas", "equipos", "talleres")


@router.post("", response_model=DonationOut, status_code=201)
def pledge(body: DonationIn, db: Session = Depends(get_db)):
    """Registra la intención de donar (público). El pago se confirma por PayPal."""
    if not body.name.strip() or len(body.name.strip()) < 2:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Nombre inválido")
    if body.amount <= 0:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Monto inválido")
    if body.cause not in CAUSES:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Causa inválida")
    row = Donation(name=body.name.strip(), email=str(body.email), amount=body.amount, cause=body.cause)
    db.add(row)
    db.commit()
    db.refresh(row)
    events.publish("cytech.donations.created", {"id": row.id, "name": row.name, "email": row.email,
                                                "amount": row.amount, "cause": row.cause})
    return DonationOut.model_validate(row)


@router.get("", response_model=PaginatedDonationsOut)
def list_all(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    stmt = select(Donation).order_by(Donation.created_at.desc())
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    pages = max((total + page_size - 1) // page_size, 1)
    page = min(page, pages)
    items = db.scalars(stmt.offset((page - 1) * page_size).limit(page_size)).all()
    return PaginatedDonationsOut(
        items=[DonationOut.model_validate(r) for r in items],
        total=total,
        page=page,
        page_size=page_size,
        pages=pages,
    )
