"""Cytech backend — FastAPI app factory (Backend-First, modular)."""
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text

from app.core.config import settings
from app.db.base import Base
from app.db.session import SessionLocal, engine
from app.api.v1.router import api_router

# Modelos registrados para create_all (en prod usar Alembic).
from app.models import conversation, donation, impact_counter, knowledge, lead, role_permission, subscriber, tax_upload, transaction, user, user_integration, tax_calendar  # noqa: F401


@asynccontextmanager
async def lifespan(_: FastAPI):
    Base.metadata.create_all(bind=engine)
    # `create_all` no anade columnas a tablas ya existentes: aplica los ALTERs
    # pendientes de `tax_calendar` (year/source) y de `users` (password_hash).
    from app.db.upgrade import upgrade_tax_calendar, upgrade_users

    upgrade_tax_calendar(engine)
    upgrade_users(engine)
    yield


def create_app() -> FastAPI:
    app = FastAPI(title="Cytech API", version="1.0.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins_list,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(api_router, prefix="/api/v1")

    from app.api.v1.endpoints import paypal_compat

    app.include_router(paypal_compat.router)  # /paypal-api/* sin prefijo (SDK v6)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = request.headers.get("X-Request-ID", str(uuid.uuid4()))
        response = await call_next(request)
        response.headers["X-Request-ID"] = rid
        return response

    @app.get("/health", tags=["ops"])
    def health() -> dict[str, str]:
        return {"status": "ok"}

    @app.get("/readyz", tags=["ops"])
    def ready() -> JSONResponse:
        try:
            db = SessionLocal()
            db.execute(text("SELECT 1"))
            db.close()
            return JSONResponse({"status": "ready", "db": "ok"})
        except Exception as e:
            return JSONResponse({"status": "not-ready", "db": str(e)}, status_code=503)

    return app


app = create_app()
