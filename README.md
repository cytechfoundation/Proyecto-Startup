# 🚀 Cytech Web — Plataforma SaaS / Cloud / Integraciones

> **Consultora técnica:** software SaaS a medida, arquitectura cloud e integraciones  
> (POS, pasarelas de pago, DIAN) • Arquitectura **Backend-First**  
> 🎓 *Formación práctica con proyectos reales, teoría interactiva y roles diferenciados*

---

## 📋 Índice Rápido

- [✨ Características](#-características)
- [🏗️ Arquitectura](#️-arquitectura)
- [📁 Estructura del Proyecto](#-estructura-del-proyecto)
- [🎯 Módulo de Cursos](#-módulo-de-cursos)
- [🔐 Roles y Permisos](#-roles-y-permisos)
- [🔌 Backend — Quickstart](#-backend--quickstart)
- [💻 Frontend — Quickstart](#-frontend--quickstart)
- [📡 Endpoints API](#-endpoints-api)
- [🛠️ Herramientas Externas](#-herramientas-externas)
- [🧪 Tecnologías](#-tecnologías)
- [🗺️ Roadmap](#-roadmap)

---

## ✨ Características

| Área | Funcionalidad | Icono |
|------|---------------|-------|
| **Autenticación** | OAuth2/OIDC con Google y GitHub (sin registro manual) | 🔐 |
| **Gestión de Usuarios** | Autocreación federada, roles dinámicos, cambio de rol por admin | 👥 |
| **Módulo de Cursos** | Cursos con proyectos externos, teoría interactiva, lecciones ordenadas | 📚 |
| **Pagos PayPal v2** | Órdenes, capturas, reembolsos, webhooks verificados | 💳 |
| **Libro Transaccional** | Facturas, pagos, estado y registro de todas las operaciones | 📒 |
| **Agente IA (RAG)** | Chat con base de conocimiento corporativa, suscripciones, inyección de documentos | 🤖 |
| **Dashboard** | Directorio de usuarios, matriz RBAC en vivo, probador de permisos | 📊 |
| **DIAN / Facturación** | Stub documentado con CUFE de prueba | 🧾 |
| **Notificaciones** | Email vía Resend (log en desarrollo) | 📧 |

---

## 🏗️ Arquitectura

```
┌─────────────────────────────────────────────────────────────┐
│                    🌐 FRONTEND (React + Vite)               │
│  Landing · Login · Dashboard · CoursePlayer · Account · Pay │
└─────────────────────────────────────────────────────────────┘
                           ↕️ HTTP/JSON
┌─────────────────────────────────────────────────────────────┐
│                  🖥️ BACKEND (FastAPI + SQLAlchemy)          │
│  Auth · Users · Courses · Payments · Agent · Transactions   │
└─────────────────────────────────────────────────────────────┘
                           ↕️ SQL
┌─────────────────────────────────────────────────────────────┐
│                 🗄️ BASE DE DATOS (SQLite / PostgreSQL)      │
│           cytech.db (desarrollo local automática)           │
└─────────────────────────────────────────────────────────────┘
```

---

## 📁 Estructura del Proyecto

```
cytech-web/
├── 📂 backend/                          # FastAPI + SQLAlchemy
│   └── 📂 app/
│       ├── 🐍 main.py                   # App factory, CORS, lifespan
│       ├── 📂 core/                     # Config, seguridad JWT, dependencias
│       ├── 📂 db/                       # Sesión, base, migraciones
│       ├── 📂 models/                   # Modelos SQLAlchemy
│       │   ├── user.py
│       │   └── course.py                # 🆕 Curso y Lección
│       ├── 📂 schemas/                  # Pydantic v2
│       │   └── course.py                # 🆕 Esquemas de cursos
│       ├── 📂 api/v1/
│       │   ├── 📂 endpoints/
│       │   │   ├── auth.py
│       │   │   ├── users.py
│       │   │   └── courses.py           # 🆕 Endpoints de cursos
│       │   └── router.py
│       └── 📂 services/
│           ├── auth_service.py
│           ├── course_service.py        # 🆕 Lógica de cursos
│           └── paypal_service.py
├── 📂 frontend/                         # React + Vite + Tailwind
│   └── 📂 src/
│       ├── 📂 pages/                    # Landing, Login, Dashboard, Courses
│       ├── 📂 components/
│       │   ├── CoursePlayer.jsx         # 🆕 Reproductor interactivo
│       │   └── FrontendCoursePanel.jsx  # 🆕 Panel de cursos
│       ├── 📂 context/                  # AuthContext
│       └── 📂 services/                 # API client
├── 📂 herramientas/                     # 🛠️ Utilidades externas
│   └── 📂 Calculadora/                  # Calculadora interactiva
│       ├── index.html
│       ├── script.js
│       └── styles.css
├── 🐳 docker-compose.yml                # Postgres + backend + frontend
├── 📄 README.md
└── 📄 API_ENDPOINTS.md
```

---

## 🎯 Módulo de Cursos

El módulo de cursos permite recibir **carpetas de proyectos externos** para usarlos en práctica junto con teoría interactiva. Está diseñado para aprendizaje práctico con tres niveles de acceso:

### 📊 Flujo del Alumno

```
Landing → Login (Google/GitHub) → Catálogo de Cursos → CoursePlayer
                                                            ↓
                                                    [Teoría] [Archivos] [Código]
                                                    (Markdown)  (Explorer)  (Interactivo)
```

### 🗂️ Estructura de Datos

| Modelo | Campos Clave | Descripción |
|--------|--------------|-------------|
| `Course` | `title`, `description`, `project_path`, `difficulty`, `category` | Curso vinculado a carpeta de proyecto |
| `Lesson` | `title`, `content_markdown`, `order`, `target_file` | Lección con teoría y archivo objetivo |

### 🔧 API de Cursos

```http
GET    /api/v1/courses          # Listar cursos (público/autenticado)
GET    /api/v1/courses/{id}     # Detalle de curso
POST   /api/v1/courses          # Crear curso (Solo ADMIN)
POST   /api/v1/lessons          # Agregar lección (ADMIN / EDITOR)
DELETE /api/v1/courses/{id}     # Eliminar curso (Solo ADMIN)
```

---

## 🔐 Roles y Permisos

El sistema utiliza **RBAC (Role-Based Access Control)** con control granular por endpoint:

| Rol | ¿Cómo se asigna? | Permisos principales |
|-----|------------------|----------------------|
| 👑 **Admin** | Email `*@cytech.com` (automático) | Crear/eliminar cursos, gestionar usuarios, cambiar roles |
| 📝 **Editor** | Asignado por Admin | Crear/editar lecciones y proyectos |
| 👤 **Client** | Cualquier otro dominio | Ver cursos, leer teoría, acceder a archivos de práctica |

### 🛡️ Matriz de Acceso

```
Endpoint                    | Admin | Editor | Client
----------------------------|-------|--------|-------
POST /courses               |   ✅  |   ❌   |   ❌
POST /lessons               |   ✅  |   ✅   |   ❌
GET /courses                |   ✅  |   ✅   |   ✅
DELETE /courses/{id}        |   ✅  |   ❌   |   ❌
PUT /users/{id}/role        |   ✅  |   ❌   |   ❌
```

---

## 🔌 Backend — Quickstart

```bash
# 1. Entrar al directorio del backend
cd backend

# 2. Copiar y configurar variables de entorno
cp .env.example .env
# Editar: DATABASE_URL, JWT_SECRET, FRONTEND_URL, etc.

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar el servidor (puerto 8000)
python -m uvicorn app.main:app --reload --port 8000
```

> 💡 **Nota:** Si no tienes PostgreSQL, el backend usa automáticamente **SQLite** (`cytech.db`) para desarrollo local.

### 🧪 Tests y Seed

```bash
# Ejecutar tests
python -m pytest tests -q

# Crear datos demo (admin@cytech.com + usuarios de prueba)
python seed_demo.py

# Indexar conocimiento para el agente IA
python seed_knowledge.py
```

---

## 💻 Frontend — Quickstart

```bash
# 1. Entrar al directorio del frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env
# VITE_API_URL=http://localhost:8000

# 4. Ejecutar en modo desarrollo (puerto 5173)
npm run dev
```

### 🎨 Flujo de Usuario

```
🏠 Landing (/)
   ↓ CTA "Ingresar a Demo Controlada"
🔐 Login (/login) — Google / GitHub (sin formulario)
   ↓ Callback OAuth2
📊 Dashboard (/dashboard) — Analíticas, directorio, matriz RBAC
   ↓ Catálogo de cursos
📚 CoursePlayer (/courses/:id) — Teoría + Archivos + Práctica
```

---

## 📡 Endpoints API

### 🔐 Autenticación

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/v1/auth/google/login` | Público | Redirige a consentimiento de Google |
| `GET` | `/api/v1/auth/google/callback` | Público | Canjea código, emite JWT propio |
| `GET` | `/api/v1/auth/github/login` | Público | Redirige a GitHub OAuth |
| `GET` | `/api/v1/auth/github/callback` | Público | Valida token y crea usuario |
| `POST` | `/api/v1/auth/federated` | Público | Valida token IdP directamente |
| `GET` | `/api/v1/auth/me` | Bearer JWT | Datos del usuario autenticado |

### 👥 Usuarios y Roles

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/v1/users` | Solo Admin | Listar usuarios con filtros |
| `PUT` | `/api/v1/users/{id}/role` | Solo Admin | Cambiar rol (admin/editor/client) |
| `PATCH` | `/api/v1/users/{id}/status` | Solo Admin | Activar/desactivar usuario |
| `GET` | `/api/v1/rbac/matrix` | Autenticado | Matriz de permisos para dashboard |

### 📚 Cursos

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/api/v1/courses` | Autenticado | Listar todos los cursos |
| `GET` | `/api/v1/courses/{id}` | Autenticado | Detalle de un curso |
| `POST` | `/api/v1/courses` | Solo Admin | Crear curso con ruta de proyecto |
| `POST` | `/api/v1/lessons` | Admin/Editor | Agregar lección teórica |
| `DELETE` | `/api/v1/courses/{id}` | Solo Admin | Eliminar curso completo |

### 💳 Pagos y Transacciones

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `POST` | `/api/v1/payments/orders` | `payments:manage` | Crear orden PayPal |
| `POST` | `/api/v1/payments/orders/{id}/capture` | Ver/Manage | Capturar pago |
| `POST` | `/api/v1/webhooks/{provider}` | Público | Ingestión de webhooks |
| `GET` | `/api/v1/transactions` | Propia/Admin | Libro transaccional |

### 📊 Sistema y Salud

| Método | Ruta | Acceso | Descripción |
|--------|------|--------|-------------|
| `GET` | `/readyz` | Público | Chequeo de base de datos |
| `GET` | `/health` | Público | Estado de la aplicación |

---

## 🛠️ Herramientas Externas

### 📐 Calculadora Interactiva

Ubicada en `herramientas/Calculadora/`, es una utilidad independiente para cálculos rápidos:

- `index.html` — Interfaz web
- `script.js` — Lógica de cálculo
- `styles.css` — Estilos modernos

Puede usarse como módulo práctico dentro de los cursos de formación.

---

## 🧪 Tecnologías

### Backend
- **FastAPI** — Framework web async
- **SQLAlchemy 2.0** — ORM y base de datos
- **Pydantic v2** — Validación de datos
- **Python-JOSE** — JWT y tokens
- **HTTPX** — Cliente HTTP para IdP
- **SQLite / PostgreSQL** — Base de datos

### Frontend
- **React 18** — Interfaz de usuario
- **Vite** — Bundler y dev server
- **Tailwind CSS** — Estilos utilitarios
- **Lucide React** — Iconografía
- **PayPal Web SDK v6** — Pagos integrados

### DevOps
- **Docker Compose** — Orquestación local
- **Pytest** — Testing backend
- **NGROK** — Túneles para webhooks

---

## 🗺️ Roadmap

- [x] ✅ Autenticación federada (Google/GitHub)
- [x] ✅ Sistema de roles RBAC
- [x] ✅ Módulo de cursos con proyectos externos
- [x] ✅ Botón de pago interactivo PayPal
- [x] ✅ Calculadora como herramienta práctica
- [ ] Agente IA con RAG completo (OpenRouter)
- [ ] Integración DIAN para facturación electrónica
- [ ] Despliegue en Vercel / Railway

---

## 📄 Licencia

MIT License © Cytech Foundation — Software libre para formación tecnológica.

---

> 💬 **¿Dudas o sugerencias?** Abre un issue en el repositorio o contacta al equipo de Cytech Foundation.
