from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.config import settings


def _make_engine():
    try:
        return create_engine(settings.database_url, pool_pre_ping=True)
    except Exception:
        # Entorno local sin driver Postgres: fallback a SQLite para dev/tests.
        return create_engine("sqlite:///./cytech.db", connect_args={"check_same_thread": False})


engine = _make_engine()
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
