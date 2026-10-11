"""Leads: captura pública + consulta admin."""
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import require_admin
from app.db.session import get_db
from app.models.lead import Lead
from app.models.user import User
from app.services import events

router = APIRouter(prefix="/leads", tags=["leads"])


class CaptchaIn(BaseModel):
    a: int = 4
    b: int = 6
    answer: int = 10


class LeadIn(BaseModel):
    nombre: str = "Ana"
    apellidos: str = "Ruiz"
    empresa: str = "Retail SAS"
    nit: str = "900123456-7"
    cargo: str = "CFO"
    email: EmailStr = "ana@retail.com"
    telefono: str = "3001112222"
    ciudad: str = "Bogotá"
    opcion: str = "100-1000 docs/mes"
    captcha: CaptchaIn


class LeadOut(BaseModel):
    id: str
    nombre: str
    empresa: str
    nit: str
    email: EmailStr
    ciudad: str
    opcion: str
    created_at: object

    model_config = {"from_attributes": True}


@router.post("", response_model=LeadOut, status_code=201)
def create(body: LeadIn, db: Session = Depends(get_db)):
    for field in ("nombre", "apellidos", "empresa", "nit", "cargo", "telefono", "ciudad"):
        if not (getattr(body, field) or "").strip():
            raise HTTPException(status.HTTP_400_BAD_REQUEST, f"Campo requerido: {field}")
    if body.captcha.answer != body.captcha.a + body.captcha.b:
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "Captcha incorrecto")
    row = Lead(nombre=body.nombre.strip(), apellidos=body.apellidos.strip(), empresa=body.empresa.strip(),
               nit=body.nit.strip(), cargo=body.cargo.strip(), email=str(body.email),
               telefono=body.telefono.strip(), ciudad=body.ciudad.strip(), opcion=body.opcion.strip())
    db.add(row)
    db.commit()
    db.refresh(row)
    events.publish("cytech.leads.created", {"id": row.id, "nombre": row.nombre, "empresa": row.empresa,
                                            "email": row.email, "opcion": row.opcion})
    return LeadOut.model_validate(row)


@router.get("", response_model=list[LeadOut])
def list_all(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    return [LeadOut.model_validate(r) for r in db.scalars(select(Lead).order_by(Lead.created_at.desc())).all()]
