"""RADIAN: registro de FEV como Título Valor, máquina de estados y conciliación."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.radian import router as radian_router
from app.api.v1.endpoints.webhooks import router as wh_router
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.models.radian import RadianEvent, RadianRecord
from app.services.auth_service import FederatedIdentity, get_or_create_user

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(radian_router, prefix="/api/v1")
app.include_router(wh_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


def _h(email: str, role: str):
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email=email, name=email, provider="google"))
    user.role = role
    db.commit()
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role=role)}"}


ADMIN = _h("radadmin@cytech.com", "admin")
EDITOR = _h("radeditor@mail.com", "editor")
CLIENT = _h("radclient@mail.com", "client")


def _create(headers=EDITOR, numero="FV-1001", adquirente="900111222-3"):
    r = client.post("/api/v1/radian/records", headers=headers, json={
        "numero": numero, "nit_emisor": "900999888-1", "nit_adquirente": adquirente,
        "valor_total": 1500000, "moneda": "COP",
    })
    return r


def test_alta_fev_genera_cufe_y_emision():
    r = _create()
    assert r.status_code == 201
    body = r.json()
    assert body["estado"] == "emitida" and len(body["cufe"]) >= 32
    detail = client.get(f"/api/v1/radian/records/{body['id']}", headers=EDITOR).json()
    assert detail["eventos"][0]["tipo"] == "emision"
    assert detail["eventos"][0]["estado_resultante"] == "emitida"


def test_rbac_editor_crea_client_no():
    assert _create().status_code == 201
    r = client.post("/api/v1/radian/records", headers=CLIENT, json={
        "numero": "FV-X", "nit_emisor": "9001", "nit_adquirente": "9002", "valor_total": 100,
    })
    assert r.status_code == 403
    assert client.post("/api/v1/radian/records", json={}).status_code == 401


def test_flujo_completo_hoja_de_vida():
    rid = _create(numero="FV-2002").json()["id"]
    pasos = [
        ("validacion", {}), ("aceptacion_expresa", {}), ("endoso", {"endosatario_nit": "800555"}),
        ("pago", {"monto_cents": 1500000}),
    ]
    for tipo, extra in pasos:
        r = client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR,
                        json={"tipo": tipo, **extra})
        assert r.status_code == 201, f"{tipo}: {r.text}"
    detail = client.get(f"/api/v1/radian/records/{rid}", headers=EDITOR).json()
    assert detail["estado"] == "pagada" and detail["endosatario_nit"] == "800555"
    assert [e["tipo"] for e in detail["eventos"]] == ["emision", "validacion", "aceptacion_expresa", "endoso", "pago"]
    # estado terminal: nada más se registra
    r = client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "pago"})
    assert r.status_code == 409


def test_transicion_invalida_y_anulacion():
    rid = _create(numero="FV-3003").json()["id"]
    # pago directo sin pasar por validación/aceptación → 409 con los permitidos
    r = client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "pago"})
    assert r.status_code == 409 and "validacion" in r.json()["detail"]
    # endoso sin endosatario → 400
    client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "validacion"})
    client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "aceptacion_tacita"})
    r = client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "endoso"})
    assert r.status_code == 400
    # anulación válida desde aceptada
    r = client.post(f"/api/v1/radian/records/{rid}/events", headers=EDITOR, json={"tipo": "anulacion"})
    assert r.status_code == 201 and r.json()["estado_resultante"] == "anulada"


def test_listado_filtro_y_alcance():
    _create(numero="FV-4004")
    r = client.get("/api/v1/radian/records", headers=EDITOR, params={"estado": "emitida"})
    assert r.status_code == 200 and r.json()["total"] >= 1
    # el cliente solo ve las suyas (creó ninguna)
    mine = client.get("/api/v1/radian/records", headers=CLIENT).json()
    assert mine["total"] == 0
    # búsqueda por CUFE parcial
    allrows = client.get("/api/v1/radian/records", headers=ADMIN, params={"all": "true"}).json()
    cufe = allrows["items"][0]["cufe"]
    found = client.get("/api/v1/radian/records", headers=ADMIN, params={"all": "true", "q": cufe[:16]}).json()
    assert found["total"] == 1


def test_catalogo():
    cat = client.get("/api/v1/radian/catalog", headers=EDITOR).json()
    assert cat["estados"]["emitida"] == "Emitida"
    assert "endoso" in cat["eventos"]
    assert cat["transiciones"]["validada"]["aceptacion_expresa"] == "aceptada"


def test_webhook_dian_concilia_hoja_de_vida():
    body = _create(numero="FV-5005").json()
    cufe = body["cufe"]
    r = client.post("/api/v1/webhooks/dian", json={"cufe": cufe, "event": "validated"})
    assert r.status_code == 200 and r.json()["reconciled"]["aplicado"] is True
    db = TestingSession()
    rec = db.scalar(select(RadianRecord).where(RadianRecord.cufe == cufe))
    assert rec.estado == "validada"
    db.close()
    # cufe desconocido y evento inválido no rompen el 2xx
    r2 = client.post("/api/v1/webhooks/dian", json={"cufe": "NO-EXISTE", "event": "paid"})
    assert r2.status_code == 200 and r2.json()["reconciled"]["aplicado"] is False
    r3 = client.post("/api/v1/webhooks/dian", json={"cufe": cufe, "event": "paid"})
    assert r3.status_code == 200 and r3.json()["reconciled"]["aplicado"] is False  # paid no es válido desde validada
    db = TestingSession()
    tipos = [e.tipo for e in db.scalars(
        select(RadianEvent).where(RadianEvent.record_id == body["id"]).order_by(RadianEvent.id.asc())).all()]
    assert tipos == ["emision", "validacion"]  # el pago inválido no añadió eventos
    db.close()
