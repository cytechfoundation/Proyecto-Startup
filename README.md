# Cytech Web — Plataforma SaaS / Cloud / Integraciones

Consultora técnica: software SaaS a medida, arquitectura cloud e integraciones
(POS, pasarelas de pago, DIAN). Arquitectura Backend-First.

## Estructura

```
cytech-web/
├── backend/               # FastAPI + SQLAlchemy + PostgreSQL
│   └── app/
│       ├── main.py        # App factory, routers, CORS
│       ├── core/          # config, security (JWT propio), deps
│       ├── db/            # session, base
│       ├── models/        # User
│       ├── schemas/       # Pydantic v2
│       ├── api/v1/        # auth (OAuth2/OIDC), users (admin)
│       └── services/      # auth_service (validación + autocreación + rol)
├── frontend/              # React (Vite) + Tailwind
│   └── src/
│       ├── pages/         # Landing, Login, Dashboard
│       ├── components/
│       ├── context/       # AuthContext
│       └── services/      # api client
├── docker-compose.yml     # Postgres + backend + frontend
└── README.md
```

## Reglas de negocio (auth federada)

- **Sin registro manual.** No existe `POST /users` público ni formulario email/password.
- Solo OAuth2/OIDC: **Google (OIDC id_token)** y **GitHub (OAuth access_token → user/emails API)**.
- Token del IdP se **valida criptográficamente** (Google: JWKS + `aud`/`iss`/`exp`; GitHub: token activo contra `api.github.com`).
- Autocreación: si el email no existe → `INSERT`. Rol automático:
  - `*@cytech.com` → `admin`
  - otro dominio → `client` (viewer)
- `GET /api/v1/users` y `PUT /api/v1/users/{id}/role` solo `admin` (JWT propio post-login).

## Backend — quickstart

```bash
cd backend
cp .env.example .env   # completar GOOGLE_CLIENT_ID/SECRET, GITHUB_*, FRONTEND_URL
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Postgres local o `docker compose up db`. Sin driver Postgres instalado, el backend
usa SQLite local (`cytech.db`) automáticamente para desarrollo.

```bash
python -m pytest tests -q   # 3 passed: rol por dominio + autocreación federada
python seed_demo.py          # crea admin@cytech.com + 2 demos
```

## Frontend — quickstart

```bash
cd frontend
npm install
cp .env.example .env   # VITE_API_URL=http://localhost:8000
npm run dev            # :5173
```

Flujo: Landing (`/`) → CTA "Ingresar a Demo Controlada" → `/login`
(botones Google/GitHub, sin formulario) → callback → `/dashboard`
(analíticas simuladas + tabla usuarios + cambio de rol si eres admin).

## Variables críticas

| Backend (`backend/.env`) | Frontend (`frontend/.env`) |
|---|---|
| `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_CLIENT_ID/SECRET`, `GITHUB_CLIENT_ID/SECRET`, `FRONTEND_URL` | `VITE_API_URL`, `VITE_GOOGLE_LOGIN_URL`, `VITE_GITHUB_LOGIN_URL` |

## Endpoints

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/v1/auth/google/login` | público (302 al consent) |
| GET | `/api/v1/auth/google/callback?code=...` | público (canjea, crea usuario, emite JWT propio, redirect a frontend) |
| GET | `/api/v1/auth/github/login` | público |
| GET | `/api/v1/auth/github/callback?code=...` | público |
| POST | `/api/v1/auth/federated` `{provider, credential}` | público (valida token del IdP directamente, p. ej. Google One Tap) |
| GET | `/api/v1/auth/me` | bearer JWT propio |
| GET | `/api/v1/users` | solo `admin` (filtros `?q=&domain=&role=&status=`) |
| PUT | `/api/v1/users/{user_id}/role` | solo `admin` (`admin`\|`editor`\|`client`) |
| PATCH | `/api/v1/users/{user_id}/status` | solo `admin` (activa/inactiva) |
| GET | `/api/v1/rbac/matrix` | autenticado (matriz única para el Dashboard) |
| GET/POST/PUT | `/api/v1/content/pos…` | según matriz (`RequirePermission`) |
| GET/POST/DELETE | `/api/v1/content/dian…` | según matriz (eliminar: solo `admin`) |
| GET/POST | `/api/v1/content/payments…` | según matriz (reembolsar: solo `admin`) |

Roles: auto-registro federado → `@cytech.com`=admin, resto=client; `editor` lo asigna un admin.
El Dashboard incluye Directorio con filtros, Matriz RBAC en vivo y probador de permisos.

## Agente IA (RAG)

Tres capas: `services/rag_service.py` (indexación + recuperación), `services/llm_service.py`
(OpenRouter chat/embeddings), `services/email_service.py` (Resend, log en dev) y
`api/v1/endpoints/agent.py` (orquestador de intenciones).

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/v1/agent/chat` `{message}` | público (`noticia:` bloqueado, `suscribir:` registra) |
| POST | `/api/v1/agent/subscribe` | público |
| GET/POST | `/api/v1/agent/knowledge` | solo `admin` (inyección en caliente) |
| GET | `/api/v1/agent/subscribers` | solo `admin` |

```bash
python seed_knowledge.py   # indexa 4 docs corporativos (usa tu OPENROUTER_API_KEY)
```

Sin key el agente responde en modo extractivo; con key usa `rag+llm`.
Widget flotante "Asistente Cytech" en toda la web + panel admin en el Dashboard.

## Libro transaccional e integraciones

| Método | Ruta | Acceso |
|---|---|---|
| GET | `/api/v1/transactions?kind=&status=&all=&page=` | propia (admin: todas) |
| POST | `/api/v1/transactions` | según matriz (factura→dian:create, pago→payments:manage) |
| POST | `/api/v1/webhooks/{paypal\|dian\|pos}` | público (ingesta, verifica si hay credenciales) |
| GET | `/readyz` | público (chequeo BD) |

`services/paypal_service.py` (órdenes/capturas, exige credenciales),
`services/dian_service.py` (stub documentado con CUFE de prueba).
`X-Request-ID` en cada respuesta. `python seed_transactions.py` para datos demo.
Mis facturas/pagos en `/cuenta` leen del libro real.

## Pagos PayPal v2 (Orders v2 + Payments v2)

Migrado según la guía v1→v2: intents en mayúsculas, `purchase_units.value/currency_code`,
`Prefer: return=representation`, `PayPal-Request-Id` por intento, `final_capture` explícito,
webhooks verificados (reemplazo de IPN) y Transaction Search (reemplazo de List Payments).

| Método | Ruta | Acceso |
|---|---|---|
| POST | `/api/v1/payments/orders` | `payments:manage` |
| GET / POST | `/api/v1/payments/orders/{id}` , `.../capture`, `.../authorize` | ver / manage |
| GET / POST | `/api/v1/payments/captures/{id}`, `.../refund` | ver / manage |
| GET / POST | `/api/v1/payments/authorizations/{id}`, `.../capture`, `.../void` | ver / manage |
| GET | `/api/v1/payments/search?start_date=&end_date=` | `payments:view` |

Todo cobro/captura/reembolso queda en el libro (`Transaction`).
Requiere `PAYPAL_CLIENT_ID/SECRET` (+ `PAYPAL_WEBHOOK_ID` para verificar); sin ellas responde 503.
