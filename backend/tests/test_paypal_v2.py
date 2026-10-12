"""PayPal v2: construcción de requests, Prefer, idempotencia y operaciones (mockeadas)."""
import sys
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import httpx
import pytest

from app.core import config
from app.services import paypal_service


@pytest.fixture(autouse=True)
def _restore_paypal_settings():
    snapshot = (config.settings.paypal_client_id, config.settings.paypal_client_secret,
                config.settings.paypal_webhook_id, config.settings.paypal_mode)
    config.settings.paypal_client_id = "test-id"
    config.settings.paypal_client_secret = "test-secret"
    config.settings.paypal_webhook_id = "WH-ID"
    yield
    (config.settings.paypal_client_id, config.settings.paypal_client_secret,
     config.settings.paypal_webhook_id, config.settings.paypal_mode) = snapshot


class FakeResp:
    def __init__(self, status=200, data=None):
        self.status_code = status
        self._data = data or {}

    def json(self):
        return self._data

    def raise_for_status(self):
        pass


def _run(fn, token_data=None, data=None, status=200):
    calls = {}

    def fake_post(url, **kw):
        calls["post"] = (url, kw)
        if "oauth2/token" in url:
            return FakeResp(200, {"access_token": "T"})
        return FakeResp(status, token_data if data is None else data)

    def fake_request(method, url, **kw):
        calls["req"] = (method, url, kw)
        return FakeResp(status, data or {})

    with patch.object(httpx, "post", side_effect=fake_post), patch.object(httpx, "request", side_effect=fake_request):
        return fn(), calls


def test_create_order_v2_shape():
    out, calls = _run(
        lambda: paypal_service.create_order("25.00", "USD", "CAPTURE", "https://a/return", "https://a/cancel",
                                            invoice_id="INV-1", custom_id="C-1"),
        data={"id": "O-1", "status": "CREATED", "links": [{"rel": "approve", "href": "https://appr"}]},
    )
    method, url, kw = calls["req"]
    assert url.endswith("/v2/checkout/orders")
    body = kw["json"]
    assert body["intent"] == "CAPTURE"
    assert body["purchase_units"][0]["amount"] == {"currency_code": "USD", "value": "25.00"}
    assert body["purchase_units"][0]["invoice_id"] == "INV-1"
    assert kw["headers"]["Prefer"] == "return=representation"
    assert kw["headers"]["PayPal-Request-Id"]
    assert out["approve_url"] == "https://appr"


def test_create_order_rechaza_sale_minuscula():
    try:
        paypal_service.create_order("10.00", intent="sale")
        raise AssertionError("debió fallar")
    except Exception as e:
        assert "CAPTURE" in str(e)


def test_create_order_con_payment_source():
    _, calls = _run(
        lambda: paypal_service.create_order("25.00", payment_method="card"),
        data={"id": "O-2", "status": "CREATED", "links": []},
    )
    src = calls["req"][2]["json"]["payment_source"]
    assert src["card"]["experience_context"]["user_action"] == "PAY_NOW"
    assert src["card"]["experience_context"]["brand_name"] == "Cytech"


def test_create_order_metodo_invalido():
    try:
        paypal_service.create_order("10.00", payment_method="pse")
        raise AssertionError("debió fallar")
    except Exception as e:
        assert "payment_method" in str(e)


def test_create_order_carrito_itemizado():
    """Esquema completo del ejemplo oficial de PayPal: ítems, desglose, envío e instrucción."""
    _, calls = _run(
        lambda: paypal_service.create_order(
            "100.00", "USD", "CAPTURE",
            reference_id="d9f80740-38f0-11e8-b467-0ed5f89f718b",
            description="Description of PU1", soft_descriptor="SOFT-1001",
            processing_instruction="ORDER_COMPLETE_ON_PAYMENT_APPROVAL",
            items=[{"name": "Item A", "category": "PHYSICAL_GOODS", "description": "Item A",
                    "sku": "259483234816", "unit_amount": "100", "quantity": 1, "tax": "0"}],
            shipping={"full_name": "John Doe", "address_line_1": "2211 N First Street",
                      "address_line_2": "Building 17", "admin_area_2": "San Jose",
                      "admin_area_1": "CA", "postal_code": "95131", "country_code": "US"},
            breakdown={"shipping": "0", "handling": "0", "tax_total": "0", "shipping_discount": "0"},
        ),
        data={"id": "O-3", "status": "CREATED", "links": []},
    )
    body = calls["req"][2]["json"]
    assert body["processing_instruction"] == "ORDER_COMPLETE_ON_PAYMENT_APPROVAL"
    unit = body["purchase_units"][0]
    assert unit["reference_id"] == "d9f80740-38f0-11e8-b467-0ed5f89f718b"
    assert unit["description"] == "Description of PU1" and unit["soft_descriptor"] == "SOFT-1001"
    assert unit["amount"]["breakdown"] == {
        "item_total": {"currency_code": "USD", "value": "100.00"},
        "shipping": {"currency_code": "USD", "value": "0"},
        "handling": {"currency_code": "USD", "value": "0"},
        "tax_total": {"currency_code": "USD", "value": "0"},
        "shipping_discount": {"currency_code": "USD", "value": "0"},
    }
    item = unit["items"][0]
    assert item["quantity"] == "1" and item["category"] == "PHYSICAL_GOODS"
    assert item["sku"] == "259483234816" and item["description"] == "Item A"
    assert item["tax"] == {"currency_code": "USD", "value": "0"}
    assert unit["shipping"]["name"]["full_name"] == "John Doe"
    assert unit["shipping"]["address"] == {
        "address_line_1": "2211 N First Street", "address_line_2": "Building 17",
        "admin_area_2": "San Jose", "admin_area_1": "CA", "postal_code": "95131",
        "country_code": "US"}


def test_create_order_desglose_con_envio_e_impuestos():
    _, calls = _run(
        lambda: paypal_service.create_order(
            "121.00",
            items=[{"name": "A", "unit_amount": "100.00", "quantity": 1}],
            breakdown={"shipping": "10.00", "tax_total": "11.00"},
        ),
        data={"id": "O-4", "status": "CREATED", "links": []},
    )
    bd = calls["req"][2]["json"]["purchase_units"][0]["amount"]["breakdown"]
    assert bd["item_total"]["value"] == "100.00"
    assert bd["shipping"]["value"] == "10.00" and bd["tax_total"]["value"] == "11.00"


def test_create_order_total_no_cuadra():
    # 100 de ítems: ni 99 solo, ni 110 con solo 5 de envío (cuadraría con 10)
    for amount, breakdown in (("99.00", None), ("110.00", {"shipping": "5.00"})):
        try:
            paypal_service.create_order(amount, items=[{"name": "A", "unit_amount": "100.00"}],
                                        breakdown=breakdown)
            raise AssertionError("debió fallar")
        except Exception as e:
            assert "cuadra" in str(e)


def test_create_order_validaciones_esquema_completo():
    casos = [
        dict(processing_instruction="AHORA_NO"),
        dict(items=[{"name": "A", "unit_amount": "1.00", "category": "SERVICIOS"}]),
        dict(items=[{"name": "A", "unit_amount": "1.00"}], shipping={"country_code": "US"}),
        dict(items=[{"name": "A", "unit_amount": "1.00"}],
             shipping={"address_line_1": "calle 1", "country_code": "CO"},
             breakdown={"shipping": "5.00"}),
    ]
    for extra in casos:
        try:
            paypal_service.create_order("1.00", **extra)
            raise AssertionError(f"debió fallar: {extra}")
        except Exception as e:
            assert getattr(e, "status_code", 500) == 400


def test_payment_methods_catalogo():
    assert {m["id"] for m in paypal_service.PAYMENT_METHODS} >= {"paypal", "card"}


def test_capture_sin_payer_id():
    _, calls = _run(lambda: paypal_service.capture_order("O-1"), data={"id": "O-1", "status": "COMPLETED"})
    _, _, kw = calls["req"]
    assert "payer_id" not in kw["json"]


def test_refund_total_cuerpo_vacio_y_sin_reason():
    _, calls = _run(lambda: paypal_service.refund_capture("C-1"), data={"id": "R-1", "status": "COMPLETED"})
    method, url, kw = calls["req"]
    assert url.endswith("/v2/payments/captures/C-1/refund")
    assert kw["json"] == {} and "reason" not in kw["json"]


def test_refund_parcial_con_note():
    _, calls = _run(lambda: paypal_service.refund_capture("C-1", "5.00", "USD", "Artículo devuelto"),
                    data={"id": "R-2"})
    assert calls["req"][2]["json"] == {
        "amount": {"currency_code": "USD", "value": "5.00"},
        "note_to_payer": "Artículo devuelto",
    }


def test_capture_auth_final_capture_explicito():
    _, calls = _run(lambda: paypal_service.capture_authorization("A-1", "50.00", "USD", True, "INV-1"),
                    data={"id": "C-9"})
    assert calls["req"][2]["json"]["final_capture"] is True


def test_void_204_sin_cuerpo():
    out, _ = _run(lambda: paypal_service.void_authorization("A-1"), data=None, status=204)
    assert out == {}


def test_search_transaction_search():
    token_calls = []

    def fake_post(url, **kw):
        token_calls.append(url)
        return FakeResp(200, {"access_token": "T"})

    def fake_get(url, **kw):
        assert url.endswith("/v1/reporting/transactions")
        assert kw["params"]["page_size"] == 5
        return FakeResp(200, {"transaction_details": [], "page": 1})

    with patch.object(httpx, "post", side_effect=fake_post), patch.object(httpx, "get", side_effect=fake_get):
        out = paypal_service.search_transactions("2025-01-01T00:00:00Z", "2025-01-31T23:59:59Z",
                                                 page_size=5)
    assert out["transaction_details"] == []
    assert any("oauth2/token" in u for u in token_calls)


def test_verify_signature_requiere_config():
    config.settings.paypal_webhook_id = ""
    assert paypal_service.verify_webhook_signature({}, "", {}) is False


def test_generate_client_token():
    calls = []

    def fake_post(url, **kw):
        calls.append(url)
        if url.endswith("/v1/identity/generate-token"):
            return FakeResp(200, {"client_token": "CT-1", "expires_in": 900})
        return FakeResp(200, {"access_token": "T"})

    with patch.object(httpx, "post", side_effect=fake_post):
        out = paypal_service.generate_client_token()
    assert out["client_token"] == "CT-1"
    assert any("generate-token" in u for u in calls)


def test_sin_credenciales_503():
    config.settings.paypal_client_id = ""
    try:
        paypal_service.create_order("1.00")
        raise AssertionError("debió fallar")
    except Exception as e:
        assert "503" in str(getattr(e, "status_code", "")) or "no configurado" in str(e).lower()


def test_normalize_capture_directa():
    n = paypal_service.normalize_capture({
        "id": "PAY-1234567890ABCDEF", "status": "COMPLETED",
        "amount": {"currency": "USD", "value": "15.00"},
    })
    assert n == {"external_id": "PAY-1234567890ABCDEF", "status": "completed",
                 "amount_cents": 1500, "currency": "USD"}


def test_normalize_capture_anidada_en_orden():
    n = paypal_service.normalize_capture({
        "id": "O-1", "status": "COMPLETED",
        "purchase_units": [{"payments": {"captures": [
            {"id": "C-1", "status": "COMPLETED",
             "amount": {"currency_code": "USD", "value": "25.00"}}]}}],
    })
    assert (n["external_id"], n["amount_cents"]) == ("C-1", 2500)


def test_normalize_capture_vacia():
    n = paypal_service.normalize_capture({})
    assert n["amount_cents"] == 0 and n["currency"] == "USD"


def test_monto_negativo_falla_antes_de_paypal():
    with patch.object(httpx, "request") as fake_req, patch.object(httpx, "post") as fake_post:
        for fn in (
            lambda: paypal_service.create_order("-5.00"),
            lambda: paypal_service.refund_capture("C-1", "-1.00"),
            lambda: paypal_service.capture_authorization("A-1", "0"),
            lambda: paypal_service.reauthorize("A-1", "abc"),
        ):
            try:
                fn()
                raise AssertionError("debió fallar con 400")
            except Exception as e:
                assert getattr(e, "status_code", None) == 400
        fake_req.assert_not_called()
        fake_post.assert_not_called()


def test_raise_propaga_detalles_paypal():
    class ErrResp:
        status_code = 422

        def json(self):
            return {"name": "VALIDATION_ERROR", "message": "Invalid request - see details",
                    "debug_id": "9adb23571c146",
                    "details": [{"field": "amount", "issue": "cannot be negative"}]}

        def raise_for_status(self):
            pass

    try:
        paypal_service._raise(ErrResp())
        raise AssertionError("debió fallar")
    except Exception as e:
        msg = e.detail
        assert "VALIDATION_ERROR" in msg and "amount: cannot be negative" in msg
        assert "9adb23571c146" in msg
