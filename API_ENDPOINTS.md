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

## 🧰 10. Herramientas (wrappers OSS + binarios locales)
Capa de adaptadores sobre librerías de código abierto (`pypdf`, `Pillow`, `zipfile`…) y ejecutables
del sistema (`git`, `node`, `pdftotext`, `pdfinfo`, `ffprobe`, `soffice`). **Solo administradores.**

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/tools` | Catálogo completo con la disponibilidad real en el servidor (`available`, `binary_path`/`module`, esquema de `params`). | ✅ (Admin) |
| `GET` | `/tools/{name}` | Detalle de una herramienta: parámetros, binario/módulo y versión instalada. | ✅ (Admin) |
| `POST` | `/tools/{name}/run` | Ejecuta la herramienta con `params` validados. Cuerpo: `{"params":{...},"timeout":15}`. | ✅ (Admin) |
| `POST` | `/tools/files` | Sube un archivo (multipart) y devuelve su `id`. | ✅ (Admin) |
| `GET` | `/tools/files` | Lista los archivos subidos. | ✅ (Admin) |
| `DELETE` | `/tools/files/{id}` | Borra un archivo subido. | ✅ (Admin) |

**Herramientas incluidas** (las no instaladas aparecen con `available: false` y `run` responde `409`):

| Herramienta | Tipo | Params | Qué hace |
| :--- | :--- | :--- | :--- |
| `pdf.info` | lib (pypdf) | `file` | Páginas, cifrado, metadatos, hash. |
| `pdf.extract` | lib (pypdf) | `file`, `pages` | Texto real (`"1-3"` o todas). |
| `pdf.merge` | lib (pypdf) | `files[]`, `name` | Une PDFs y devuelve el id generado. |
| `text.stats` | lib (stdlib) | `file` | Bytes/líneas/palabras + sha256. |
| `zip.list` | lib (stdlib) | `file`, `limit` | Entradas de un comprimido. |
| `image.info` | lib (Pillow) | `file` | Dimensiones, modo y formato. |
| `xlsx.rows` | lib (openpyxl) | `file`, `sheet`, `max_rows` | Filas de una hoja como JSON. |
| `git.version` / `node.version` | binario | — | Smoke test del runner. |
| `pdfinfo.meta` / `pdftotext.extract` | binario (Poppler) | `file` | Metadatos / texto con layout. |
| `ffprobe.probe` | binario (FFmpeg) | `file` | Formato y pistas multimedia. |
| `soffice.convert` | binario (LibreOffice) | `file`, `format` | Conversión headless → archivo nuevo. |

**Seguridad del runner**: sin `shell` (solo `argv` en lista), ejecutable resuelto en el servidor con
`shutil.which` (el cliente nunca envía rutas ni comandos), archivos referenciados por `id` dentro de
`data/tools` (traversal rechazado con `422`), entorno reducido (no hereda secretos), cwd temporal,
`timeout` duro (default 15 s, máx. 60 s) y salida recortada a 200 KB.

### Ejemplo: subir un PDF y extraer su texto (ReadyAPI / curl)
```bash
# 1) sube el archivo y guarda el id
curl -X POST "http://localhost:8000/api/v1/tools/files" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -F "file=@informe.pdf"
# → {"id":"bc772d8b48e09259","name":"informe.pdf","size":18340,"sha256":"…"}

# 2) ejecuta una herramienta con ese id
curl -X POST "http://localhost:8000/api/v1/tools/pdf.extract/run" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"params":{"file":"bc772d8b48e09259","pages":"1-2"},"timeout":15}'
# → {"tool":"pdf.extract","ok":true,"output":{"pages_read":[1,2],"total_pages":3,
#     "chars":1820,"text":"…"},"exit_code":null,"duration_ms":12,"truncated":false}
```

---

## 📊 11. Contadores de Impacto (becas, equipos, talleres)
Cifras de impacto que publica la sección **Donar** de la página principal, guardadas en BD y
actualizables desde el panel admin de `/cuenta`. La primera lectura siembra los valores por defecto
(`becas: 100`, `equipos: 250`, `talleres: 500`); el catálogo de claves es cerrado.

| Método | Endpoint | Descripción | Auth |
| :--- | :--- | :--- | :--- |
| `GET` | `/impact/counters` | Lista todos los contadores (`key`, `value`, `label`, `unit`, `updated_at`). Siembra los que falten. | Público |
| `GET` | `/impact/counters/{key}` | Un contador por clave (`becas` \| `equipos` \| `talleres`). | Público |
| `PUT` | `/impact/counters/{key}` | Fija el valor. Cuerpo: `{"value": 120}` (0 ≤ value ≤ 1 000 000). | ✅ (Admin) |
| `POST` | `/impact/counters/{key}/adjust` | Suma/resta unidades. Cuerpo: `{"delta": 1}` (−1000 ≤ delta ≤ 1000; nunca baja de 0). | ✅ (Admin) |

Clave inexistente → `404`. Valor fuera de rango → `422`. La siembra es idempotente: leer dos veces
no reinicia el valor editado.

### Ejemplo: registrar una beca nueva (ReadyAPI / curl)
```bash
# la landing consulta esto sin token
curl "http://localhost:8000/api/v1/impact/counters/becas"
# → {"key":"becas","value":100,"label":"Becas de estudio","unit":"becas","updated_at":"…"}

# el panel admin de /cuenta suma una beca recién otorgada
curl -X POST "http://localhost:8000/api/v1/impact/counters/becas/adjust" \
  -H "Authorization: Bearer <ADMIN_TOKEN>" -H "Content-Type: application/json" \
  -d '{"delta": 1}'
# → {"key":"becas","value":101,"label":"Becas de estudio","unit":"becas","updated_at":"…"}
```

---

### 🛠 Notas Técnicas
- **Headers Requeridos**: `Authorization: Bearer <token>` para rutas marcadas con ✅.
- **Formato de Respuesta**: JSON.
- **Errores Comunes**:
  - `401 Unauthorized`: Token ausente o expirado.
  - `403 Forbidden`: El usuario no tiene el rol necesario (Admin).
  - `400 Bad Request`: Error de validación en el payload (ver Swagger para ejemplos).
