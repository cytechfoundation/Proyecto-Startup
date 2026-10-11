"""Reglas críticas: rol por dominio + autocreación federada (sin registro manual)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.services.auth_service import FederatedIdentity, get_or_create_user, resolve_role


def _session():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_admin_domain():
    assert resolve_role("ana@cytech.com") == "admin"
    assert resolve_role("ANA@CYTECH.COM") == "admin"


def test_client_domain():
    assert resolve_role("x@gmail.com") == "client"
    assert resolve_role("y@startup.co") == "client"


def test_autocreate_and_idempotent():
    db = _session()
    ident = FederatedIdentity(email="jefe@cytech.com", name="Jefe", provider="google")
    u1, created1 = get_or_create_user(db, ident)
    assert created1 is True and u1.role == "admin"
    u2, created2 = get_or_create_user(db, ident)
    assert created2 is False and u1.id == u2.id

    c1, cc = get_or_create_user(db, FederatedIdentity(email="cli@gmail.com", name="Cli", provider="github"))
    assert cc is True and c1.role == "client"
    db.close()
