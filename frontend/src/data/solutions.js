import {
  Cloud,
  UtensilsCrossed,
  Leaf,
  Rocket,
  Network,
  ReceiptText,
  CreditCard,
  FileCheck2,
  RefreshCcw,
  BellRing,
  BarChart3,
  Sprout,
  QrCode,
  Truck,
  Store,
  Wifi,
  Lock,
  Gauge,
} from "lucide-react";

/** Ficha completa por solución. Las tarjetas enlazan a /soluciones/:slug. */
export const SOLUTIONS = [
  {
    slug: "gastronomia-retail",
    kind: "segmento",
    Icon: UtensilsCrossed,
    title: "Gastronomía / Retail",
    tagline: "Vende sin fricción: POS, DIAN y pagos conciliados en tiempo real.",
    short:
      "Integración POS, facturación electrónica DIAN y pasarelas de pago en tiempo real, con conciliación automática de cada transacción.",
    description: [
      "En restaurantes y retail cada segundo en caja cuesta dinero. Conectamos tu POS con la facturación electrónica de la DIAN y tus pasarelas de pago para que cada venta nazca facturada, cobrada y conciliada, sin digitación manual ni cierres eternos.",
      "El middleware Cytech orquesta el flujo completo: el ticket del POS genera el documento equivalente o la factura electrónica, la pasarela confirma el pago y el sistema concilia montos, propinas, descuentos e impuestos automáticamente.",
    ],
    features: [
      { Icon: QrCode, title: "POS conectado", text: "Tickets, mesas y turnos sincronizados con inventario y caja en tiempo real." },
      { Icon: FileCheck2, title: "Factura DIAN automática", text: "Emisión y validación ante la DIAN sin salir del flujo de venta." },
      { Icon: CreditCard, title: "Pagos multicanal", text: "Tarjetas, PSE, billeteras y links de pago con confirmación inmediata." },
      { Icon: RefreshCcw, title: "Conciliación automática", text: "Cada transacción cruza venta, pago e impuesto sin intervención." },
      { Icon: BellRing, title: "Alertas de caja", text: "Diferencias, anulaciones y devoluciones notificadas al instante." },
      { Icon: BarChart3, title: "Cierre en minutos", text: "Reportes de turno, canal y medio de pago listos al cerrar." },
    ],
    integrations: ["POS / comandas", "DIAN", "Pasarelas de pago", "PSE", "Inventario", "Contabilidad"],
    kpis: [
      { value: "< 2 s", label: "venta a factura" },
      { value: "100%", label: "ventas conciliadas" },
      { value: "-80%", label: "tiempo de cierre" },
    ],
    steps: [
      { title: "Diagnóstico", text: "Mapeamos tu POS, pagos y proceso DIAN actual." },
      { title: "Integración", text: "Conectamos sistemas vía middleware con reintentos y observabilidad." },
      { title: "Operación", text: "Ventas facturadas y conciliadas en vivo, con soporte." },
    ],
  },
  {
    slug: "negocios-sostenibles",
    kind: "segmento",
    Icon: Leaf,
    title: "Negocios Sostenibles",
    tagline: "Trazabilidad y reportes que certifican tu impacto.",
    short:
      "Trazabilidad, reportes y automatización cloud con arquitectura eficiente, lista para certificar tu operación.",
    description: [
      "Los negocios verdes necesitan probar lo que prometen. Digitalizamos tu cadena con trazabilidad por lote, reportes de impacto y automatización cloud de bajo consumo.",
      "Cada movimiento queda registrado y es auditable: origen, transformación, distribución y venta, con dashboards listos para certificadoras e inversionistas.",
    ],
    features: [
      { Icon: Sprout, title: "Trazabilidad por lote", text: "Origen y recorrido de cada producto, de finca a cliente." },
      { Icon: BarChart3, title: "Reportes de impacto", text: "Métricas ambientales y sociales exportables para certificación." },
      { Icon: Cloud, title: "Cloud eficiente", text: "Infraestructura optimizada que reduce costo y huella." },
      { Icon: Truck, title: "Logística visible", text: "Rutas, entregas y devoluciones monitoreadas en vivo." },
    ],
    integrations: ["ERP", "IoT / sensores", "DIAN", "E-commerce", "Certificadoras"],
    kpis: [
      { value: "360°", label: "visibilidad de cadena" },
      { value: "-40%", label: "costo cloud" },
      { value: "1 clic", label: "reporte de impacto" },
    ],
    steps: [
      { title: "Mapeo", text: "Identificamos actores y datos de tu cadena." },
      { title: "Digitalización", text: "Trazabilidad y reportes automatizados." },
      { title: "Certificación", text: "Evidencia lista para auditorías." },
    ],
  },
  {
    slug: "startups",
    kind: "segmento",
    Icon: Rocket,
    title: "Startups",
    tagline: "Del MVP al scale-up sin reescribir nada.",
    short:
      "MVPs SaaS multitenant, APIs y middleware listos para escalar desde el día uno, sin deuda técnica.",
    description: [
      "Lanza rápido sin hipotecar tu futuro: construimos MVPs SaaS multitenant con APIs limpias, autenticación federada y arquitectura que escala de 10 a 10.000 clientes.",
      "Backend-First desde el día uno: el mismo código de tu MVP sostiene tu crecimiento, con observabilidad, facturación DIAN y pagos integrados cuando los necesites.",
    ],
    features: [
      { Icon: Rocket, title: "MVP en semanas", text: "Alcance recortado a lo que valida mercado, sin atajos técnicos." },
      { Icon: Network, title: "APIs limpias", text: "Contratos versionados listos para tu app, web e integraciones." },
      { Icon: Lock, title: "Auth federada", text: "Login con Google/GitHub y roles desde el primer deploy." },
      { Icon: Gauge, title: "Escala real", text: "Multitenant, colas y caché preparados para el crecimiento." },
    ],
    integrations: ["Auth federada", "Pagos", "DIAN", "Email / SMS", "Analytics"],
    kpis: [
      { value: "4-8 sem", label: "MVP a producción" },
      { value: "0", label: "reescrituras" },
      { value: "99.9%", label: "uptime objetivo" },
    ],
    steps: [
      { title: "Alcance", text: "Definimos el corte mínimo que valida." },
      { title: "Construcción", text: "Sprints con demos semanales." },
      { title: "Lanzamiento", text: "Deploy, monitoreo y iteración." },
    ],
  },
  {
    slug: "middleware-apis",
    kind: "servicio",
    Icon: Network,
    title: "Middleware / APIs",
    tagline: "Todos tus sistemas hablando el mismo idioma.",
    short:
      "Orquestación de integraciones POS, pagos y ERP con observabilidad, reintentos y webhooks en tiempo real.",
    description: [
      "El middleware Cytech es el pegamento de tu operación: conecta POS, pasarelas, ERP y DIAN con reintentos automáticos, colas y trazabilidad total.",
      "Webhooks en tiempo real avisan a cada sistema cuando algo pasa, y la observabilidad muestra cada transacción de punta a punta.",
    ],
    features: [
      { Icon: Network, title: "Orquestación", text: "Flujos multi-sistema con compensaciones y reintentos." },
      { Icon: BellRing, title: "Webhooks", text: "Eventos en tiempo real hacia tus sistemas." },
      { Icon: BarChart3, title: "Observabilidad", text: "Logs, métricas y trazas por transacción." },
      { Icon: Lock, title: "Seguridad", text: "Firmas, idempotencia y control por roles." },
    ],
    integrations: ["POS", "ERP", "Pagos", "DIAN", "Webhooks"],
    kpis: [
      { value: "ms", label: "latencia p95" },
      { value: "100%", label: "trazabilidad" },
      { value: "24/7", label: "monitoreo" },
    ],
    steps: [
      { title: "Mapeo", text: "Inventario de sistemas y eventos." },
      { title: "Orquestación", text: "Flujos, reintentos y webhooks." },
      { title: "Operación", text: "Monitoreo y evolución." },
    ],
  },
  {
    slug: "arquitectura-cloud",
    kind: "servicio",
    Icon: Cloud,
    title: "Arquitectura Cloud",
    tagline: "Infraestructura que no te despierta de noche.",
    short:
      "Infraestructura resiliente e IaC con despliegues Backend-First, ambientes aislados y rollback seguro.",
    description: [
      "Diseñamos tu nube como código: ambientes aislados, despliegues automáticos y rollback en un clic.",
      "Backend-First significa que la API manda: contratos estables, versionado y compatibilidad garantizada para web, móvil e integraciones.",
    ],
    features: [
      { Icon: Cloud, title: "IaC", text: "Infraestructura versionada y reproducible." },
      { Icon: Store, title: "Ambientes aislados", text: "Dev, staging y prod sin sorpresas." },
      { Icon: RefreshCcw, title: "Rollback seguro", text: "Vuelve atrás en minutos ante cualquier incidente." },
      { Icon: Wifi, title: "Alta disponibilidad", text: "Multi-zona con recuperación automática." },
    ],
    integrations: ["AWS / GCP", "Docker", "CI/CD", "Monitoreo", "Backups"],
    kpis: [
      { value: "IaC", label: "100% versionado" },
      { value: "min", label: "rollback" },
      { value: "99.9%", label: "uptime" },
    ],
    steps: [
      { title: "Diseño", text: "Arquitectura según carga y presupuesto." },
      { title: "Automatización", text: "Pipelines y ambientes como código." },
      { title: "Operación", text: "SLOs, alertas y mejora continua." },
    ],
  },
  {
    slug: "facturacion-dian",
    kind: "servicio",
    Icon: ReceiptText,
    title: "Facturación DIAN",
    tagline: "Cada factura válida, a la primera.",
    short:
      "Emisión, validación y eventos DIAN con conciliación automática y trazabilidad transacción por transacción.",
    description: [
      "Emitimos facturas, notas y documentos equivalentes validados ante la DIAN, con manejo de contingencias y reintentos.",
      "Cada documento queda conciliado con su pago y disponible para descarga, con estado visible en tiempo real.",
    ],
    features: [
      { Icon: FileCheck2, title: "Emisión validada", text: "Documentos aceptados por la DIAN a la primera." },
      { Icon: RefreshCcw, title: "Contingencia", text: "Reintentos y cola ante caídas del servicio DIAN." },
      { Icon: BellRing, title: "Eventos", text: "Webhooks de aceptación, rechazo y acuse." },
      { Icon: BarChart3, title: "Conciliación", text: "Factura contra pago, automáticamente." },
    ],
    integrations: ["DIAN", "POS", "ERP", "Contabilidad", "Pagos"],
    kpis: [
      { value: "99%+", label: "aceptación" },
      { value: "auto", label: "contingencia" },
      { value: "vivo", label: "estado DIAN" },
    ],
    steps: [
      { title: "Habilitación", text: "Resolución y ambiente DIAN configurados." },
      { title: "Emisión", text: "Documentos desde tu flujo de venta." },
      { title: "Conciliación", text: "Cruce automático con pagos." },
    ],
    infra: {
      title: "Opción de infraestructura: autohospedada",
      text: "Si no quieres pagar mensualidades por volumen de documentos o prefieres controlar el 100% de la infraestructura, existen wrappers de código abierto y ejecutables locales que transforman tus peticiones JSON en el protocolo XML/SOAP de la DIAN.",
      options: [
        "Caja General (Favi): ejecutable o Docker con SDKs para PHP, Node.js, Java o C#.",
        "Librerías open source PHP/Python (esquemas Soenac) para firma XAdES-EPES.",
      ],
      foot: "Soberanía de datos + cero costo por timbrado.",
    },
  },
];

export const findSolution = (slug) => SOLUTIONS.find((s) => s.slug === slug);

/** Reverso de cada tarjeta: qué hace el Middleware/APIs en ese punto.
 *  Clave: slug → título del feature → explicación del reverso. */
export const MIDDLEWARE_BACKS = {
  "gastronomia-retail": {
    "POS conectado":
      "El middleware escucha cada ticket del POS vía webhook, lo normaliza a un formato único y lo publica en la cola de ventas para que facturación e inventario reaccionen en milisegundos.",
    "Factura DIAN automática":
      "Transforma la venta al esquema exigido por la DIAN, firma, transmite y reintenta ante caídas; guarda el CUFE y el estado de aceptación por documento.",
    "Pagos multicanal":
      "Orquesta la pasarela: crea la intención de cobro, confirma el pago y publica el evento pago.confirmado que dispara la conciliación automática.",
    "Conciliación automática":
      "Cruza venta vs. pago vs. impuesto con reglas de tolerancia; solo escala a un humano lo que realmente no cuadra.",
    "Alertas de caja":
      "Reglas sobre el stream de eventos: diferencias de caja, anulaciones y devoluciones generan notificaciones inmediatas al encargado.",
    "Cierre en minutos":
      "Agrega turnos por canal y medio de pago desde el log inmutable de eventos; el reporte de cierre sale solo, sin planillas.",
  },
};

/** Nota genérica del reverso para las demás soluciones. */
export const MIDDLEWARE_NOTES = {
  "negocios-sostenibles":
    "El middleware publica cada evento de la cadena (lote creado, movido, vendido) en un log inmutable que alimenta la trazabilidad y los reportes de impacto.",
  startups:
    "Desde el día uno exponemos APIs versionadas con auth federada: el mismo middleware que usa tu MVP escala contigo sin reescribir nada.",
  "middleware-apis":
    "Así opera por dentro: colas, reintentos con backoff, idempotencia y trazas por transacción en cada flujo que orquesta.",
  "arquitectura-cloud":
    "Cada despliegue expone la API solo tras health-checks; el rollback revierte middleware y workers juntos, sin ventanas rotas.",
  "facturacion-dian":
    "Cola de documentos con reintento exponencial ante la DIAN; cada cambio de estado se publica como evento para tus sistemas.",
};

export const middlewareBack = (slug, title) =>
  MIDDLEWARE_BACKS[slug]?.[title] || MIDDLEWARE_NOTES[slug] || "Orquestado por el middleware Cytech en tiempo real.";
