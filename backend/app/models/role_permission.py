"""Override manual de la matriz RBAC (interruptores del Dashboard)."""
from sqlalchemy import Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base


class RolePermission(Base):
    __tablename__ = "role_permissions"
    __table_args__ = (UniqueConstraint("resource", "action", "role", name="uq_perm_cell"),)

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    resource: Mapped[str] = mapped_column(String(40), nullable=False)
    action: Mapped[str] = mapped_column(String(40), nullable=False)
    role: Mapped[str] = mapped_column(String(20), nullable=False)
    allowed: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
