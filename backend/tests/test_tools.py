"""Capa de herramientas: catálogo, seguridad del runner y ejecución real.

Cubre inventario/estado (admin), subida de archivos por id, ejecución de
binarios locales reales (git, node), wrappers de libs OSS (pypdf, zipfile,
Pillow) y los límites de seguridad: sin shell, sin traversal, timeout y salida
recortada.
"""
import hashlib
import io
import os
import sys
import zipfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.api.v1.endpoints.auth import router as auth_router
from app.api.v1.endpoints.tools import router as tools_router
from app.core.config import settings
from app.core.security import create_access_token
from app.db.base import Base
from app.db.session import get_db
from app.services import tools as tools_pkg
from app.services.auth_service import FederatedIdentity, get_or_create_user
from app.services.tools import files, registry, runner

engine = create_engine("sqlite://", poolclass=StaticPool, connect_args={"check_same_thread": False})
TestingSession = sessionmaker(bind=engine)
Base.metadata.create_all(bind=engine)

app = FastAPI()
app.include_router(auth_router, prefix="/api/v1")
app.include_router(tools_router, prefix="/api/v1")


def _override():
    db = TestingSession()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = _override
client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _almacen_aislado(tmp_path, monkeypatch):
    """Las pruebas usan un almacén temporal: nunca tocan `backend/data/tools`."""
    monkeypatch.setattr(files, "TOOLS_DIR", tmp_path)
    yield


def _admin_h():
    db = TestingSession()
    user, _ = get_or_create_user(db, FederatedIdentity(email="a@cytech.com", name="A", provider="google"))
    uid = str(user.id)
    db.close()
    return {"Authorization": f"Bearer {create_access_token(subject=uid, role='admin')}"}


def _upload(name: str, content: bytes) -> str:
    r = client.post("/api/v1/tools/files", files={"file": (name, content, "application/octet-stream")},
                    headers=_admin_h())
    assert r.status_code == 201, r.text
    return r.json()["id"]


def _run(name: str, params: dict, timeout=None):
    return client.post(f"/api/v1/tools/{name}/run", json={"params": params, "timeout": timeout},
                       headers=_admin_h())


def make_pdf(pages: list[list[str]]) -> bytes:
    """PDF mínimo multi-página (sin dependencias) para probar los wrappers."""
    n = len(pages)
    objs = ["<< /Type /Catalog /Pages 2 0 R >>"]
    kids = " ".join(f"{3 + i * 2} 0 R" for i in range(n))
    objs.append(f"<< /Type /Pages /Kids [{kids}] /Count {n} >>")
    for i, lines in enumerate(pages):
        content = "BT /F1 12 Tf 72 720 Td 16 TL\n"
        for line in lines:
            safe = line.replace("\\", r"\\").replace("(", r"\(").replace(")", r"\)")
            content += f"({safe}) Tj T*\n"
        content += "ET"
        objs.append(
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents {4 + i * 2} 0 R "
            f"/Resources << /Font << /F1 {3 + n * 2} 0 R >> >> >>"
        )
        objs.append(f"<< /Length {len(content)} >>\nstream\n{content}\nendstream")
    objs.append("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")

    out = bytearray(b"%PDF-1.4\n")
    offsets = [0]
    for i, body in enumerate(objs, start=1):
        offsets.append(len(out))
        out += f"{i} 0 obj\n{body}\nendobj\n".encode("latin-1")
    xref = len(out)
    out += f"xref\n0 {len(objs) + 1}\n".encode() + b"0000000000 65535 f \n"
    for off in offsets[1:]:
        out += f"{off:010d} 00000 n \n".encode()
    out += (f"trailer\n<< /Size {len(objs) + 1} /Root 1 0 R >>\nstartxref\n{xref}\n%%EOF").encode()
    return bytes(out)


# ---------------------------------------------------------------- catálogo
def test_inventario_requiere_admin():
    assert client.get("/api/v1/tools").status_code in (401, 403)
    assert client.post("/api/v1/tools/git.version/run", json={}).status_code in (401, 403)


def test_inventario_declara_disponibilidad():
    body = client.get("/api/v1/tools", headers=_admin_h()).json()
    assert body["count"] == len(registry.REGISTRY) >= 10
    names = {t["name"] for t in body["tools"]}
    assert {"git.version", "pdf.info", "pdftotext.extract", "text.stats"} <= names
    for t in body["tools"]:
        assert set(t) >= {"name", "kind", "title", "description", "available", "params", "requires_file"}
    git = next(t for t in body["tools"] if t["name"] == "git.version")
    assert git["available"] is True and git["binary_path"]
    xlsx = next(t for t in body["tools"] if t["name"] == "xlsx.rows")
    assert xlsx["available"] == (registry.is_available(registry.REGISTRY["xlsx.rows"]))


def test_detalle_de_herramienta_y_404():
    r = client.get("/api/v1/tools/pdf.extract", headers=_admin_h())
    assert r.status_code == 200
    body = r.json()
    assert body["module"] == "pypdf" and body["params"]["pages"]["type"] == "str"
    assert client.get("/api/v1/tools/no.existe", headers=_admin_h()).status_code == 404
    assert _run("no.existe", {}).status_code == 404


# ---------------------------------------------------------------- binarios
def test_runner_binario_real_git():
    r = _run("git.version", {})
    assert r.status_code == 200
    body = r.json()
    assert body["ok"] is True and body["exit_code"] == 0
    assert body["stdout"].startswith("git version")
    assert body["output"]["command"].startswith("git --version")
    assert body["output"]["version"].startswith("git version")
    assert body["duration_ms"] >= 0 and body["timed_out"] is False


def test_runner_node_si_existe():
    spec = registry.REGISTRY["node.version"]
    if not registry.is_available(spec):
        return  # el binario no está instalado en esta máquina: nada que comprobar
    body = _run("node.version", {}).json()
    assert body["ok"] is True and body["stdout"].strip().startswith("v")


def test_runner_no_expone_shell():
    """Los parámetros no se concatenan en una cadena: argv en lista, sin shell."""
    spec = registry.REGISTRY["git.version"]
    assert isinstance(spec.argv_builder({}), list)
    result = runner.run_command([registry._bin_available(spec), "--version"], tool="git.version")
    assert result.ok and "git version" in result.stdout


def test_timeout_del_runner():
    res = runner.run_command([sys.executable, "-c", "import time; time.sleep(5)"],
                             tool="demo", timeout=1)
    assert res.timed_out is True and res.ok is False and "Tiempo agotado" in res.stderr


def test_salida_recortada():
    res = runner.run_command([sys.executable, "-c", "print('x' * 400000)"], tool="demo", timeout=20)
    assert res.truncated is True and len(res.stdout.encode()) <= settings.tools_max_output_kb * 1024 + 64


def test_entorno_saneado_no_hereda_secretos():
    os.environ["CYTECH_TEST_SECRETO"] = "valor-secreto"
    try:
        res = runner.run_command(
            [sys.executable, "-c", "import os; print(os.environ.get('CYTECH_TEST_SECRETO', 'ausente'))"],
            tool="demo", timeout=20,
        )
    finally:
        del os.environ["CYTECH_TEST_SECRETO"]
    assert res.stdout.strip() == "ausente", "el hijo no debe heredar variables del padre"


def test_herramienta_binaria_no_disponible_devuelve_409():
    spec = registry.REGISTRY["soffice.convert"]
    if registry.is_available(spec):
        return
    r = _run("soffice.convert", {"file": "0000000000000000"})
    assert r.status_code == 409 and "no disponible" in r.json()["detail"]


# ---------------------------------------------------------------- libs OSS
def test_upload_y_estadisticas_de_texto():
    contenido = "hola mundo\nsegunda linea\n"
    fid = _upload("notas.txt", contenido.encode())
    body = _run("text.stats", {"file": fid}).json()
    assert body["ok"] is True
    assert body["output"]["bytes"] == len(contenido.encode())
    assert body["output"]["lines"] == 2 and body["output"]["words"] == 4
    assert body["output"]["sha256"] == hashlib.sha256(contenido.encode()).hexdigest()


def test_listado_y_borrado_de_archivos():
    fid = _upload("borrable.txt", b"temporal")
    listing = client.get("/api/v1/tools/files", headers=_admin_h()).json()
    assert any(f["id"] == fid for f in listing["files"])
    assert client.delete(f"/api/v1/tools/files/{fid}", headers=_admin_h()).status_code == 204
    assert _run("text.stats", {"file": fid}).status_code == 422
    assert client.delete("/api/v1/tools/files/zzz", headers=_admin_h()).status_code == 422


def test_pdf_info_y_extract():
    fid = _upload("informe.pdf", make_pdf([["Pagina uno", "Cytech"], ["Pagina dos"]]))
    info = _run("pdf.info", {"file": fid}).json()
    assert info["ok"] is True and info["output"]["pages"] == 2
    assert info["output"]["name"].endswith(".pdf") and len(info["output"]["sha256"]) == 64

    ext = _run("pdf.extract", {"file": fid, "pages": "1-1"}).json()
    assert ext["ok"] is True and ext["output"]["pages_read"] == [1]
    assert "Pagina uno" in ext["output"]["text"] and "Pagina dos" not in ext["output"]["text"]

    todo = _run("pdf.extract", {"file": fid}).json()
    assert todo["output"]["total_pages"] == 2 and "Pagina dos" in todo["output"]["text"]


def test_pdf_merge_genera_archivo():
    a = _upload("a.pdf", make_pdf([["Uno"]]))
    b = _upload("b.pdf", make_pdf([["Dos"]]))
    body = _run("pdf.merge", {"files": [a, b], "name": "unido.pdf"}).json()
    assert body["ok"] is True and body["output"]["name"] == "unido.pdf"
    info = _run("pdf.info", {"file": body["output"]["file"]}).json()
    assert info["output"]["pages"] == 2


def test_zip_list():
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w") as zf:
        zf.writestr("docs/uno.txt", "hola")
        zf.writestr("docs/dos.txt", "mundo")
    fid = _upload("paquete.zip", buf.getvalue())
    body = _run("zip.list", {"file": fid}).json()
    assert body["output"]["total"] == 2
    assert {e["name"] for e in body["output"]["entries"]} == {"docs/uno.txt", "docs/dos.txt"}


def test_image_info():
    try:
        from PIL import Image
    except ImportError:  # pragma: no cover
        return
    buf = io.BytesIO()
    Image.new("RGB", (12, 8), color=(0, 128, 255)).save(buf, format="PNG")
    fid = _upload("pixel.png", buf.getvalue())
    body = _run("image.info", {"file": fid}).json()
    assert body["ok"] is True
    assert body["output"]["width"] == 12 and body["output"]["height"] == 8
    assert body["output"]["format"] == "PNG"


# ---------------------------------------------------------------- seguridad
def test_parametros_invalidos():
    assert _run("pdf.info", {}).status_code == 422                 # falta file
    assert _run("pdf.info", {"file": "x", "extra": 1}).status_code == 422  # parámetro desconocido
    assert _run("pdf.info", {"file": "no-existe"}).status_code == 422      # id inexistente
    assert _run("pdf.extract", {"file": "0000000000000000", "pages": "zarpa"}).status_code == 422
    assert _run("pdf.info", {"file": 123}).status_code == 422      # tipo incorrecto


def test_path_traversal_rechazado():
    fid = _upload("ok.txt", b"contenido")
    for malo in ["../app/main.py", "..%2f..%2f.env", "/etc/passwd", "C:\\Windows\\win.ini",
                 f"{fid}/../../secreto", "~/.ssh/id_rsa"]:
        assert _run("text.stats", {"file": malo}).status_code == 422, malo


def test_timeout_limitado_en_api():
    fid = _upload("ok.txt", b"hola")
    assert _run("text.stats", {"file": fid}, timeout=999).status_code == 422   # pydantic: le=60
    assert _run("text.stats", {"file": fid}, timeout=0).status_code == 422


def test_upload_demasiado_grande(monkeypatch):
    monkeypatch.setattr(settings, "tools_max_upload_mb", 0)  # cualquier archivo supera 0 MB
    r = client.post("/api/v1/tools/files", files={"file": ("g.txt", b"xyz", "text/plain")}, headers=_admin_h())
    assert r.status_code == 422 and "máximo" in r.json()["detail"]


def test_formato_de_conversion_seguro():
    """El validador de formatos de soffice rechaza cualquier cosa que no sea un token simple."""
    from app.services.tools.registry import _check_format
    assert _check_format("pdf") == "pdf"
    for malo in ["pdf; rm -rf /", "--outdir=/tmp", "a b", "$(whoami)"]:
        try:
            _check_format(malo)
            raise AssertionError(f"debió rechazar: {malo}")
        except tools_pkg.ToolParamsError:
            pass
