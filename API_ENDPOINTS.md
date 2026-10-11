# 📑 Documentación de API - Cytech Platform

Esta guía detalla todos los endpoints disponibles en la API de Cytech, organizados por funcionalidad. La API sigue el estándar REST y utiliza JWT para la autenticación.

**Base URL:** `http://localhost:8000/api/v1`

---

## 🔐 1. Autenticación y Usuarios
Gestión de acceso, sesiones y perfiles.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/auth/demo` | Acceso rápido mediante email (demo). | ❌ |
| `GET` | `/auth/me` | Obtiene el perfil del usuario autenticado. | ✅ |
| `GET` | `/users` | Lista de usuarios (paginado). | ✅ (Admin) |
| `PUT` | `/users/{id}/role` | Cambia el rol de un usuario (`admin`, `user`). | ✅ (Admin) |
| `PATCH` | `/users/{id}/status` | Activa o desactiva una cuenta de usuario. | ✅ (Admin) |

---

## 👤 2. Cuenta y Perfil
Configuración personal y resumen de actividad.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/account/summary` | Resumen de actividad y estado de la cuenta. | ✅ |
| `PUT` | `/account/profile` | Actualiza la información del perfil. | ✅ |
| `PUT` | `/account/terms` | Marca los términos y condiciones como aceptados. | ✅ |
| `DELETE` | `/account/me` | Elimina la cuenta del usuario actual. | ✅ |

---

## 🤖 3. Agente AI y RAG (diálogo multiturno)
El asistente recuerda la conversación: puede **preguntar un dato en un turno y recibirlo en el siguiente** (slot-filling).

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/agent/chat` | Envía un mensaje. Con `session_id` mantiene el flujo entre turnos; sin él responde de forma aislada. | ❌ |
| `GET` | `/agent/conversations/{external_id}` | Inspecciona una sesión: flujo activo, paso, slots e historial. | ✅ (Admin) |
| `DELETE` | `/agent/conversations/{external_id}` | Reinicia el estado de una sesión. | ❌ |
| `POST` | `/agent/subscribe` | Suscripción directa por JSON (`{email}`). | ❌ |
| `GET` | `/agent/knowledge` | Lista los documentos cargados en el RAG. | ✅ |
| `POST` | `/agent/knowledge` | Sube un nuevo documento para entrenamiento. | ✅ |
| `GET` | `/agent/subscribers` | Lista de suscriptores del boletín. | ✅ (Admin) |

**Cuerpo de `POST /agent/chat`**

| Campo | Tipo | Descripción |
| :--- | :--- | :--- |
| `message` | string | Texto del usuario (obligatorio). |
| `session_id` | string | Id de sesión del cliente. Web: uuid generado por el widget; WhatsApp: `wa:<número>`. `null` ⇒ estado sin memoria. |
| `channel` | string | `web` (default) o `whatsapp`. Las sesiones se separan por canal. |

**Respuesta**: `intent`, `success`, `reply`, `flow` (flujo activo o `null`), `step`, `suggestions` (chips para el cliente) y, en consultas RAG, `sources`.

**Flujos guiados** (se activan por intención; cualquiera se cancela escribiendo "cancelar"):

| Flujo | Disparadores | Pasos que recoge |
| :--- | :--- | :--- |
| `subscribe` | "quiero suscribirme", "newsletter", "boletín" | `email` |
| `contact` | "contactar", "asesor", "hablar con" | `nombre` → `email` → `mensaje` (crea Lead y notifica) |
| `tax` | "calendario", "tributario", "impuesto", "DIAN", "IVA", "retenciones" | `scope` (impuesto/periodo) y responde con RAG |

### Ejemplo de diálogo multiturno (ReadyAPI / curl)
```bash
# Turno 1: el agente pide el correo y abre el flujo `subscribe`
curl -X POST "http://localhost:8000/api/v1/agent/chat" -H "Content-Type: application/json" \
  -d '{"message":"quiero suscribirme","session_id":"demo-1","channel":"web"}'
# → {"intent":"FLUJO_PASO","flow":"subscribe","step":"email",
#    "reply":"¡Genial! ¿A qué correo te suscribo? ...","suggestions":["Cancelar"]}

# Turno 2: la respuesta del usuario completa el flujo
curl -X POST "http://localhost:8000/api/v1/agent/chat" -H "Content-Type: application/json" \
  -d '{"message":"mi correo es ana@correo.com","session_id":"demo-1","channel":"web"}'
# → {"intent":"RESPONDER_SUSCRIPCION","flow":null,
#    "reply":"Suscripción procesada y alerta enviada a ana@correo.com (canal: log)."}

# Inspección de la sesión (admin)
curl "http://localhost:8000/api/v1/agent/conversations/demo-1" -H "Authorization: Bearer <ADMIN_TOKEN>"
# → {"external_id":"demo-1","channel":"web","flow":null,"step":null,
#    "slots":{},"history":[{"role":"user",...},{"role":"bot",...}]}
```
En WhatsApp el notifier envía `session_id="wa:<número>"`, así que una conversación
por teléfono también recuerda los datos entre mensajes.


---

## 📱 4. WhatsApp & Webhooks
Integración con Meta Cloud API y eventos externos.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/whatsapp/webhook` | Validación de token (Handshake de Meta). | ❌ |
| `POST` | `/whatsapp/webhook` | Recepción de mensajes en tiempo real. | ❌ |
| `POST` | `/webhooks` | Ingesta de webhooks genéricos (PayPal, etc). | ❌ |

---

## 💳 5. Pagos y Donaciones
Flujos de PayPal v2 y capturas de donaciones.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/donations` | Registra una intención de donación. | ❌ |
| `POST` | `/payments/donate/orders` | Crea orden de PayPal para donación. | ❌ |
| `POST` | `/payments/donate/orders/{id}/capture` | Captura el pago de la donación. | ❌ |
| `POST` | `/payments/orders` | Crea orden de pago personalizada. | ✅ |
| `GET` | `/payments/search` | Busca transacciones por rango de fechas. | ✅ |

---

## 📈 6. Transacciones y Leads
Seguimiento financiero y captación de clientes.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/transactions` | Historial de movimientos (facturas/pagos). | ✅ |
| `POST` | `/leads` | Registro de prospectos (Formulario Facturación). | ❌ |
| `GET` | `/leads` | Consulta de leads capturados. | ✅ (Admin) |

---

## ⚙️ 7. Integraciones y RBAC
Conectores externos y matriz de permisos.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/integrations` | Lista integraciones activas del usuario. | ✅ |
| `GET` | `/integrations/all` | Catálogo de todas las integraciones disponibles. | ✅ |
| `POST` | `/integrations/{provider}` | Conecta una cuenta externa. | ✅ |
| `DELETE` | `/integrations/{provider}` | Desconecta una integración. | ✅ |
| `GET` | `/rbac/matrix` | Obtiene la matriz de permisos global. | ✅ |
| `PUT` | `/rbac/matrix` | Actualiza un permiso específico en la matriz. | ✅ (Admin) |

---

## 📄 8. Gestión de Contenido
Rutas y configuraciones de servicios.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/content/pos` | Configuración de puntos de venta. | ✅ |
| `GET` | `/content/dian` | Configuración de servicios DIAN. | ✅ |
| `GET` | `/content/payments` | Configuración de pasarelas de pago. | ✅ |

---

## 📅 9. Calendario Tributario y WhatsApp
Importación del calendario DIAN (**almacenado por año**), exportación iCal y webhook de WhatsApp.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `POST` | `/tax-calendar/import?year=2026` | Importa el calendario desde un PDF (multipart). Cada evento se guarda con su `year` (el del propio evento) y el `source` (nombre del archivo). Devuelve `created`, `duplicates`, `total_parsed`, `first_date`, `last_date` y `years` (reparto por año). **Idempotente**. | ✅ (Admin) |
| `GET` | `/tax-calendar/events?year=2026` | Lista los eventos importados. `year` es opcional: sin él devuelve todos los años. Soporta también `?category=`. Cada elemento incluye `year` y `source`. | ❌ |
| `GET` | `/tax-calendar/years` | Años disponibles con su conteo de eventos y archivos de origen. Ideal para poblar selectores de año. | ❌ |
| `DELETE` | `/tax-calendar/events?year=2026` | Elimina todos los eventos importados de un año (para recargar una versión corregida del PDF). | ✅ (Admin) |
| `GET` | `/tax-calendar/ics?year=2026` | Exporta el calendario en **iCal (.ics)** para Windows Calendar, Outlook y Google Calendar. Devuelve `text/calendar`: calendario base DIAN del año + los eventos importados de ese mismo año. | ❌ |
| `GET` | `/whatsapp` | Verificación del webhook (Meta `hub.challenge`). | ❌ (token) |
| `POST` | `/whatsapp` | Ingesta de mensajes; publica en Kafka `cytech.whatsapp.incoming`. | ❌ (token) |

### Ejemplo de importación por año (ReadyAPI / curl)
```bash
curl -X POST "http://localhost:8000/api/v1/tax-calendar/import?year=2026" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" \
  -F "file=@Calendario_Tributario_2026.pdf;type=application/pdf"
```
Respuesta:
```json
{
  "message": "Importación exitosa: 110 eventos nuevos, 0 duplicados omitidos.",
  "filename": "Calendario_Tributario_2026.pdf",
  "year": 2026,
  "created": 110, "duplicates": 0, "total_parsed": 118,
  "first_date": "2026-01-13", "last_date": "2027-01-20",
  "years": { "2026": 102, "2027": 8 }
}
```

---

### 🛠 Notas Técnicas
- **Headers Requeridos**: `Authorization: Bearer <token>` para rutas marcadas con ✅.
- **Formato de Respuesta**: JSON.
- **Errores Comunes**:
  - `401 Unauthorized`: Token ausente o expirado.
  - `403 Forbidden`: El usuario no tiene el rol necesario (Admin).
  - `400 Bad Request`: Error de validación en el payload (ver Swagger para ejemplos).
