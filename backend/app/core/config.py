from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql+psycopg2://cytech:cytech@localhost:5432/cytech"
    jwt_secret: str = "change-me-32-chars-minimum"
    jwt_algorithm: str = "HS256"
    jwt_expire_minutes: int = 60

    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://localhost:8000/api/v1/auth/google/callback"

    github_client_id: str = ""
    github_client_secret: str = ""
    github_redirect_uri: str = "http://localhost:8000/api/v1/auth/github/callback"

    frontend_url: str = "http://localhost:5173"
    admin_domain: str = "cytech.com"
    cors_origins: str = "http://localhost:5173"
    # Demo local: permite POST /auth/demo sin IdP. ¡En producción: false!
    demo_login_enabled: bool = True
    # PayPal (sandbox por defecto; el checkout real exige client_id/secret)
    paypal_client_id: str = ""
    paypal_client_secret: str = ""
    paypal_mode: str = "sandbox"
    paypal_webhook_id: str = ""
    # Bus de eventos (vacío = solo log; con broker = Kafka real)
    kafka_brokers: str = ""
    # WhatsApp Cloud API (Meta)
    whatsapp_verify_token: str = "cytech-dev"
    whatsapp_token: str = ""
    whatsapp_phone_number_id: str = ""
    paypal_identity_redirect_uri: str = "http://localhost:8000/api/v1/integrations/paypal/callback"
    # Agente IA (OpenRouter: chat + embeddings; Resend: email)
    openrouter_api_key: str = ""
    openrouter_chat_model: str = "openai/gpt-4o-mini"
    openrouter_embed_model: str = "openai/text-embedding-3-small"
    resend_api_key: str = ""
    # Capa de herramientas (wrappers de libs OSS + binarios locales del sistema)
    tools_dir: str = "data/tools"        # almacén de archivos que alimentan las herramientas
    tools_max_upload_mb: int = 12
    tools_max_output_kb: int = 200
    tools_default_timeout: int = 15
    tools_max_timeout: int = 60
    tax_uploads_dir: str = "data/tax_calendar"  # PDFs del Calendario Tributario subidos por admin
    tax_max_upload_mb: int = 12

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    model_config = {"env_file": ".env", "extra": "ignore"}


settings = Settings()
