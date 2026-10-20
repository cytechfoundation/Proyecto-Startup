---
name: cytech-saas
description: >-
  Guía práctica para desarrollar, depurar, probar y desplegar el SaaS de Cytech
  Foundation. Resume su arquitectura, comandos de desarrollo, autenticación,
  convenciones visuales y particularidades del entorno.
---

# Cytech SaaS

Aplica estas pautas al trabajar en este repositorio. Consulta `README.md` y
`API_ENDPOINTS.md` cuando necesites detalles de arranque, datos demo o contratos
de API.

## Arquitectura

- `backend/`: FastAPI + SQLAlchemy; SQLite local en `backend/cytech.db`. Los
  endpoints usan el prefijo `/api/v1/`.
- `frontend/`: SPA React 18 + Vite 5 + Tailwind 3, sin SSR.
- `services/`: wrappers de Kafka y RAG para el flujo WhatsApp ⇄ Kafka ⇄ RAG.
- `docker-compose.yml`: infraestructura auxiliar, incluido Kafka.
- `API_ENDPOINTS.md`: contratos; presta atención a §9 (PDF del calendario DIAN)
  y §11 (contadores de impacto).
- `README.md`: instrucciones de arranque y scripts de datos demo
  (`seed_demo.py`, `seed_knowledge.py`, `seed_transactions.py`).

## Desarrollo local

Ejecuta desde la carpeta indicada. El backend va **sin `--reload`**: reinícialo
manualmente después de modificar código.

```powershell
# Desde backend/
C:\Python314\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# Desde frontend/
npm run dev
```

El frontend queda en `http://localhost:5173`. Reiniciar el entorno puede detener
los procesos en segundo plano; vuelve a iniciarlos y autentícate de nuevo.

## Autenticación de desarrollo

Solicita un token con `POST /api/v1/auth/demo` y un cuerpo como:

```json
{"email": "admin@cytech.com"}
```

Guarda el token en `localStorage` bajo `cytech_token`. Debes repetir la
autenticación después de reiniciar el backend. Usuarios del selector de roles:

| Rol | Correo |
|---|---|
| admin | `admin@cytech.com` |
| editor | `operador@gmail.com` |
| client | `demo.retail@gmail.com` |

## Verificación

- Backend: desde `backend/`, ejecuta
  `C:\Python314\python.exe -m pytest` (la suite suele tener alrededor de 169
  pruebas).
- Frontend: desde `frontend/`, ejecuta `npm run build` después de cada cambio
  de interfaz; no hay una suite de pruebas frontend documentada.
- Para validar la UI en ejecución, usa las herramientas de navegador. En
  `browser.evaluate`, proporciona una IIFE bajo la clave `script`. Si falla una
  captura con la ventana minimizada, verifica el DOM.

## Convenciones del dashboard

- El dashboard permanece oscuro: `--t-*` no cambia con el modo claro. Conserva
  contraste claro sobre oscuro; las variables `--l-*` corresponden al modo
  claro de otras superficies.
- Tarjetas: `rounded-xl bg-[var(--t-surface)] p-5`.
- Mantén chips de resumen en encabezados, tablas con encabezado sticky en
  mayúsculas y hover por fila, skeleton durante la carga y CTA en estados vacíos.
- Usa `frontend/src/data/roles.js` (`ROLE_META`/`roleMeta`) como fuente única
  para identidad de roles: admin violeta, editor celeste y client esmeralda.
  La comparten RbacMatrix, UserDirectory y PermissionTester.
- Las etiquetas de causas de Donar se definen en
  `frontend/src/data/foundation.js`: becas violeta, equipos celeste y talleres
  ámbar.

## Git, seguridad y particularidades

- Rama principal: `main`; remoto:
  `https://github.com/cytechfoundation/Proyecto-Startup.git`.
- Nunca incluyas `.env` ni credenciales en commits. PayPal y OPENROUTER son
  secretos del backend y deben mantenerse fuera del repositorio.
- En PowerShell, un push puede mostrar código de salida 1 aunque haya tenido
  éxito porque Git escribe mensajes en stderr; confirma el resultado en la
  salida de Git.
- La regla `/data/` de `.gitignore` está anclada a la raíz deliberadamente:
  cambiarla por `data/` ignoraría `frontend/src/data/`.
- El `503` de `/api/v1/payments/client-token` en desarrollo es preexistente
  cuando faltan credenciales de PayPal; no lo atribuyas a cambios no
  relacionados.
- Los cambios de rol son asíncronos: espera a que finalicen antes de recargar.
  Los `aria-label` de los toggles RBAC incluyen `: permitido` o `: bloqueado`
  según el estado seleccionado.
- No están disponibles poppler, ffprobe, soffice ni openpyxl; sí están
  disponibles git, node, pypdf y Pillow.
