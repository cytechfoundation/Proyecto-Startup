from fastapi import APIRouter

from app.api.v1.endpoints import account, agent, auth, content, donations, integrations, leads, payments, tools, transactions, users, webhooks, whatsapp, tax_calendar

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(account.router)
api_router.include_router(integrations.router)
api_router.include_router(donations.router)
api_router.include_router(agent.router)
api_router.include_router(payments.router)
api_router.include_router(leads.router)
api_router.include_router(transactions.router)
api_router.include_router(webhooks.router)
api_router.include_router(whatsapp.router)
api_router.include_router(tax_calendar.router)
api_router.include_router(content.router)
api_router.include_router(tools.router)
