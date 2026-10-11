"""Seed de conocimiento corporativo del asistente (usa retrieval por keywords si no hay key)."""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.services.rag_service import add_document

DOCS = [
    ("Servicios Cytech",
     "Cytech ofrece middleware e integraciones de APIs, arquitectura cloud e IaC, y facturación electrónica validada ante la DIAN con conciliación automática de pagos.",
     "corporate"),
    ("Segmentos de clientes",
     "Atendemos Gastronomía y Retail (POS, DIAN y pagos en tiempo real), Negocios Sostenibles (trazabilidad y reportes) y Startups (MVPs SaaS multitenant).",
     "corporate"),
    ("Acceso a la demo",
     "El acceso es solo con identidad federada Google o GitHub, sin contraseñas. Las cuentas @cytech.com reciben rol Administrador y el resto Cliente.",
     "corporate"),
    ("Cytech Foundation",
     "Cytech Foundation impulsa becas de estudio, equipamiento tecnológico y talleres gratuitos. Dona por PayPal o escribe a cytechfoundation@gmail.com.",
     "corporate"),
    ("Facturación DIAN autohospedada",
     "Si no quieres pagar mensualidades por volumen de documentos o prefieres controlar el 100% de la infraestructura y la soberanía de tus datos, existen wrappers de código abierto y ejecutables locales que transforman tus peticiones JSON locales en el protocolo XML/SOAP que exige la DIAN. Alternativas: Caja General (Favi), con ejecutable o contenedor Docker y SDKs para PHP, Node.js, Java o C#, y librerías open source en PHP o Python (como los esquemas de Soenac) para firmar el XML con el estándar obligatorio XAdES-EPES. Así reduces costos de timbrado y controlas toda la infraestructura.",
     "infra"),
]

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for title, content, source in DOCS:
    doc = add_document(db, title, content, source)
    print("INDEXED", doc.title)
db.close()
