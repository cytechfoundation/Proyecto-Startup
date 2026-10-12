---
name: cytech-saas
description: >-
  Guía de trabajo para el SaaS de Cytech Foundation (backend FastAPI + SQLite,
  frontend React 18/Vite 5/Tailwind, servicios Kafka/RAG). Úsala al modificar
  este repositorio: arrancar servidores de desarrollo, autenticarte en dev,
  probar cambios, trabajar el dashboard, hacer push o preparar despliegues.
  Incluye comandos exactos, cuentas demo, el sistema de diseño del dashboard y
  gotchas del entorno.
---

# Cytech SaaS — guía de trabajo

Conocimiento específico de este proyecto que el agente no puede deducir solo.

## Arquitectura

- `backend/` — FastAPI + SQLAlchemy sobre **SQLite en dev** (`backend/cytech.db`). Todo bajo `/api/v1/...`.
- `frontend/` — SPA React 18 + Vite 5 + Tailwind 3 (sin SSR).
- `services/` — wrappers de Kafka/RAG (flujo WhatsApp ⇄ Kafka ⇄ respuesta RAG).
- `docker-compose.yml` — infraestructura (Kafka etc.).
- `API_ENDPOINTS.md` — referencia de endpoints por secciones (§9 subidas de PDF del calendario DIAN, §11 contadores de impacto).
- `README.md` — arranque y seeding (`seed_demo.py`, `seed_knowledge.py`, `seed_transactions.py`).

## Servidores de desarrollo

Backend (desde `backend/`, **sin `--reload`**: reiniciar a mano tras cada cambio):

```powershell
C:\Python314\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Frontend (desde `frontend/`):

```powershell
npm run dev   # → http://localhost:5173
```

Un reinicio del servidor cancela los procesos en segundo plano: relanzar ambos y volver a autenticarte.

## Autenticación dev

```http
POST /api/v1/auth/demo
{"email": "admin@cytech.com"}
```

Guardar el token como `cytech_token` en `localStorage`. **Hay que repetirlo tras cada reinicio del backend.** Cuentas del switcher de roles del dashboard:

| Rol | Email |
|---|---|
| admin | `admin@cytech.com` |
| editor | `operador@gmail.com` |
| client | `demo.retail@gmail.com` |

## Verificación de cambios

1. Backend: `C:\Python314\python.exe -m pytest` desde `backend/` — la suite (~169 tests) debe quedar en verde.
2. Frontend: `npm run build` desde `frontend/` tras **cada** cambio de UI (no hay tests de frontend; el build es la comprobación).
3. UI en vivo: usar las tools de navegador. `browser.evaluate` exige IIFE con clave `script`. Las capturas fallan si la ventana está minimizada → verificar vía DOM.

## Línea visual del dashboard

- El dashboard es **oscuro fijo**: las variables `--t-*` no cambian en modo claro (solo `--l-*`), así que usar colores Tailwind fijos claros-sobre-oscuro.
- Tarjetas: `rounded-xl bg-[var(--t-surface)] p-5`.
- Cabeceras con chips de resumen (icono + contador); tablas con cabecera *sticky* en mayúsculas y filas con hover; skeleton al cargar; estado vacío con CTA.
- Identidad de rol (iconos + clases) sale de la única fuente `frontend/src/data/roles.js` (`ROLE_META`/`roleMeta`): admin violeta, editor cielos, client esmeralda. La usan RbacMatrix, UserDirectory y PermissionTester.
- Causas/etiquetas del Donar: `frontend/src/data/foundation.js` (becas violeta, equipos cielos, talleres ámbar).

## Git

- Rama `main`; remoto `https://github.com/cytechfoundation/Proyecto-Startup.git`.
- En PowerShell el push **reporta exit code 1 aunque salga bien** (git escribe a stderr) — verificar el resultado leyendo la salida, no el código.
- **Nunca** commitear `.env` ni secretos (PayPal/OPENROUTER solo en backend, fuera del repo).

## Gotchas

- `.gitignore` ancla `/data/` a raíz **a propósito**: una regla `data/` ignoraría también `frontend/src/data/` (donde vive `roles.js`).
- El error `/api/v1/payments/client-token` → 503 en dev es **preexistente** (PayPal sin credenciales), no es regresión.
- Los cambios de rol del dashboard son asíncronos: esperar a que terminen antes de recargar (riesgo de carrera).
- aria-labels de los toggles RBAC llevan sufijo «: permitido/bloqueado» al seleccionarlos.
- Entorno **sin** poppler/ffprobe/soffice/openpyxl; **con** git, node, pypdf y Pillow.
