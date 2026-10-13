"""Esquemas RADIAN: registro de FEV como Título Valor y su hoja de vida."""
from datetime import datetime

from pydantic import BaseModel, Field


class RadianRecordIn(BaseModel):
    numero: str = Field(min_length=1, max_length=40, description="Número de la factura de venta")
    nit_emisor: str = Field(min_length=5, max_length=20)
    nit_adquirente: str = Field(min_length=5, max_length=20)
    valor_total: int = Field(ge=1, description="Valor total en centavos")
    moneda: str = Field(default="COP", max_length=10)
    payload: dict | None = None  # datos extra del documento (JSON)


class RadianEventIn(BaseModel):
    tipo: str = Field(description="validacion | aceptacion_expresa | aceptacion_tacita | rechazo | endoso | pago | anulacion")
    actor: str | None = Field(default=None, max_length=120)
    detalle: str | None = Field(default=None, max_length=2000)
    monto_cents: int | None = Field(default=None, ge=0, description="Monto del pago/endoso si aplica")
    endosatario_nit: str | None = Field(default=None, max_length=20, description="NIT del endosatario (endoso)")


class RadianEventOut(BaseModel):
    id: int
    record_id: str
    tipo: str
    actor: str
    detalle: str | None
    monto_cents: int | None
    estado_resultante: str
    created_at: datetime

    model_config = {"from_attributes": True}


class RadianRecordOut(BaseModel):
    id: str
    numero: str
    nit_emisor: str
    nit_adquirente: str
    valor_total: int
    moneda: str
    estado: str
    endosatario_nit: str | None
    cufe: str
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class RadianRecordDetailOut(RadianRecordOut):
    eventos: list[RadianEventOut] = []


class PaginatedRadianOut(BaseModel):
    items: list[RadianRecordOut]
    total: int
    page: int
    page_size: int
    pages: int
