"""Seed demo: admin + editor + clientes (solo para desarrollo local)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.user import User
from app.services.auth_service import FederatedIdentity, get_or_create_user

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for ident in [
    FederatedIdentity(email="admin@cytech.com", name="Admin Cytech", provider="google"),
    FederatedIdentity(email="operador@gmail.com", name="Operador Demo", provider="github"),
    FederatedIdentity(email="demo.retail@gmail.com", name="Demo Retail", provider="google"),
]:
    user, created = get_or_create_user(db, ident)
    print(("CREATED" if created else "EXISTS"), user.email, user.role)

# El rol editor se asigna manualmente (el auto-registro solo da admin/client).
op = db.query(User).filter_by(email="operador@gmail.com").one()
op.role = "editor"
db.commit()
print("ROLE", op.email, op.role)
db.close()
