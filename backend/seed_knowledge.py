"""Seed de conocimiento corporativo del asistente (usa retrieval por keywords si no hay key).

Idempotente: los docs que ya existen con el mismo título y contenido se omiten;
si cambió el contenido se reindexa (y se le añade el embedding si faltaba).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))

from sqlalchemy import select

from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.models.knowledge import KnowledgeDoc
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

    # ---------------------------------------------------------- becas (modelos de financiación)
    ("Programa de becas Cytech Foundation — modelos de financiación",
     "El programa de becas de Cytech Foundation se financia desde el modelo comercial de la empresa, con tres vías que pueden ofrecerse al mismo cliente. "
     "Flujo: el cliente de software/consultoría paga una factura comercial normal (100% deducible como gasto operativo) a la S.A.S.; de ahí un porcentaje de utilidad o un rubro de co-formación pasa a una cuenta restringida y de ahí el pago directo a la universidad o al becario. "
     "Las tres vías son: 1) Compra con Propósito (porcentaje fijo de la venta), 2) Consultoría + Semillero de Talento (patrocinio corporativo) y 3) Fondos Complementarios con registro BIC. "
     "El reglamento de las becas (promedio requerido, áreas de estudio) lo diseña la empresa en sus propios términos y condiciones, sin depender de la aprobación de un tercero.",
     "becas"),
    ("Becas Cytech — Compra con Propósito (porcentaje de ventas)",
     "Modelo Compra con Propósito: al vender licencias de software, desarrollos a medida o consultoría, el contrato estipula que un porcentaje fijo de la compra (ej. 5% o 10%) se destina directamente al fondo de becas de Cytech Foundation. "
     "Manejo contable: el cliente paga una factura comercial normal por los servicios tecnológicos; la empresa registra el ingreso total, deduce sus costos y transfiere ese porcentaje a una cuenta restringida exclusiva para el pago de matrículas. "
     "Beneficio para el cliente: deduce el 100% del valor de la factura como gasto operativo de su negocio y, al mismo tiempo, cumple con sus metas de responsabilidad social.",
     "becas"),
    ("Becas Cytech — Consultoría + Semillero de Talento (patrocinio corporativo)",
     "Modelo Consultoría + Semillero de Talento: se vende un paquete de consultoría tecnológica a un cliente corporativo y, como parte del entregable, Cytech selecciona, capacita y beca a estudiantes en áreas tecnológicas clave (programación, nube, ciberseguridad) bajo los requerimientos específicos de ese cliente. "
     "Manejo contable: el cliente contrata bajo un objeto contractual como 'Consultoría especializada y desarrollo de capacidades tecnológicas'. "
     "Beneficio mutuo: para el cliente es un gasto de operación deducible de impuestos; para Cytech es un ingreso comercial; el estudiante recibe la beca y, al graduarse, puede realizar prácticas o ser contratado directamente por el cliente que financió su proceso.",
     "becas"),
    ("Becas Cytech — Fondos Complementarios con registro BIC",
     "Modelo Fondos Complementarios mediante el Registro BIC (Beneficio e Interés Colectivo): al constituir o actualizar la S.A.S. como Empresa BIC, Cytech obtiene una reputación oficial que le permite competir con más fuerza en licitaciones públicas y privadas de software, porque el Estado y las grandes corporaciones priorizan a proveedores con sello social. "
     "Financiamiento alternativo: las empresas BIC acceden a líneas de crédito preferenciales (tasas más bajas) en bancos locales y a fondos de inversión internacionales de impacto para apalancar sus programas sociales como el de becas.",
     "becas"),
]

Base.metadata.create_all(bind=engine)
db = SessionLocal()
for title, content, source in DOCS:
    row = db.scalar(select(KnowledgeDoc).where(KnowledgeDoc.title == title))
    if row is not None:
        if row.content == content and row.embedding:
            print("OK      ", title)
            continue
        db.delete(row)
        db.commit()
    doc = add_document(db, title, content, source)
    print("INDEXED ", doc.title)
db.close()
