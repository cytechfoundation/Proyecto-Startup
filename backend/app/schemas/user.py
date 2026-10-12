import uuid
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, EmailStr, Field

Role = Literal["admin", "editor", "client"]
Status = Literal["active", "inactive"]
Provider = Literal["google", "github"]


class UserOut(BaseModel):
    id: uuid.UUID
    email: EmailStr
    name: str
    provider: str
    role: str
    status: str
    company: str | None = None
    phone: str | None = None
    nit: str | None = None
    person_type: str | None = None
    terms_accepted_at: datetime | None = None
    created_at: datetime
    last_login_at: datetime | None = None

    model_config = {"from_attributes": True}


class FederatedLoginIn(BaseModel):
    """Login directo con credencial del IdP (ej. Google One Tap id_token)."""

    provider: Provider
    credential: str  # id_token (google) o access_token (github)


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class RegisterIn(BaseModel):
    """Alta de cuenta con email+password (provider "local")."""

    name: str = Field(min_length=2, max_length=200)
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)  # política real: en auth_service
    terms: bool = False


class PasswordLoginIn(BaseModel):
    """Login con email+password para cuentas locales."""

    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RoleUpdateIn(BaseModel):
    role: Role


class PaginatedUsersOut(BaseModel):
    items: list[UserOut]
    total: int
    page: int
    page_size: int
    pages: int


class StatusUpdateIn(BaseModel):
    status: Status

class ProfileUpdateIn(BaseModel):
    """Edición propia del perfil (Mi cuenta). El email lo gobierna el IdP."""

    name: str | None = None
    company: str | None = None
    phone: str | None = None
    nit: str | None = None
    person_type: Literal["natural", "juridica"] | None = None


class TermsAcceptIn(BaseModel):
    accepted: bool


class DeleteConfirmIn(BaseModel):
    email: str


class PermissionUpdateIn(BaseModel):
    resource: str
    action: str
    role: str
    allowed: bool


class DonationIn(BaseModel):
    name: str
    email: EmailStr
    amount: int
    cause: str


class DonationOut(BaseModel):
    id: int
    name: str
    email: EmailStr
    amount: int
    cause: str
    created_at: datetime

    model_config = {"from_attributes": True}

class PaginatedDonationsOut(BaseModel):
    items: list[DonationOut]
    total: int
    page: int
    page_size: int
    pages: int


class TransactionIn(BaseModel):
    provider: str  # paypal | dian | pos | demo
    kind: str  # invoice | payment | refund
    amount: int  # centavos COP
    currency: str = "COP"
    external_id: str | None = None
    payload: dict | None = None


class TransactionOut(BaseModel):
    id: str
    user_id: str | None
    provider: str
    kind: str
    amount: int
    currency: str
    status: str
    external_id: str | None
    event_id: str | None = None
    created_at: datetime

    model_config = {"from_attributes": True}


class PaginatedTransactionsOut(BaseModel):
    items: list[TransactionOut]
    total: int
    page: int
    page_size: int
    pages: int


class IntegrationOut(BaseModel):
    provider: str
    connected: bool
    account: str | None = None
    verified: bool = False

    model_config = {"from_attributes": True}


class IntegrationConnectIn(BaseModel):
    account: str | None = None
