"""Matriz RBAC: decisiones de autorización por rol/recurso/acción + switches persistidos."""
import sys
from types import SimpleNamespace
from pathlib import Path

import pytest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.rbac import (
    DEFAULT_MATRIX,
    RequirePermission,
    get_matrix,
    is_allowed,
    set_permission,
)
from app.db.base import Base


def _db():
    engine = create_engine("sqlite:///:memory:")
    Base.metadata.create_all(bind=engine)
    return sessionmaker(bind=engine)()


def test_admin_todo():
    for resource, actions in DEFAULT_MATRIX.items():
        for action in actions:
            assert is_allowed("admin", resource, action), (resource, action)


def test_editor_limites():
    assert is_allowed("editor", "pos", "edit")
    assert is_allowed("editor", "dian", "create")
    assert is_allowed("editor", "payments", "view")
    assert not is_allowed("editor", "pos", "delete")
    assert not is_allowed("editor", "dian", "delete")
    assert not is_allowed("editor", "payments", "manage")


def test_client_viewer():
    assert is_allowed("client", "dian", "view")
    assert is_allowed("client", "dian", "download")
    assert not is_allowed("client", "pos", "view")
    assert not is_allowed("client", "payments", "view")
    assert not is_allowed("client", "dian", "create")


def test_require_permission_bloquea():
    gate = RequirePermission("dian", "delete")
    assert gate(SimpleNamespace(role="admin"), None).role == "admin"
    with pytest.raises(HTTPException) as e:
        gate(SimpleNamespace(role="editor"), None)
    assert e.value.status_code == 403


def test_switch_activa_y_aplica():
    db = _db()
    assert not is_allowed("client", "pos", "view", db)
    set_permission(db, "pos", "view", "client", True)
    assert is_allowed("client", "pos", "view", db)
    assert "client" in get_matrix(db)["pos"]["view"]
    gate = RequirePermission("pos", "view")
    assert gate(SimpleNamespace(role="client"), db).role == "client"
    db.close()


def test_switch_desactiva_y_vuelve_a_fabrica():
    db = _db()
    assert is_allowed("editor", "dian", "create", db)
    set_permission(db, "dian", "create", "editor", False)
    assert not is_allowed("editor", "dian", "create", db)
    set_permission(db, "dian", "create", "editor", True)  # restaura default
    assert is_allowed("editor", "dian", "create", db)
    db.close()


def test_switch_invalido():
    db = _db()
    with pytest.raises(HTTPException):
        set_permission(db, "pos", "view", "superadmin", True)
    with pytest.raises(HTTPException):
        set_permission(db, "nada", "ver", "client", True)
    db.close()
