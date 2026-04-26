from fastapi import APIRouter

from app.api.v1 import alerts, auth, budget_items, companies, dashboard, expenses, fiscal_years, imports, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(fiscal_years.router)
api_router.include_router(budget_items.router)
api_router.include_router(expenses.router)
api_router.include_router(alerts.router)
api_router.include_router(dashboard.router)
api_router.include_router(imports.router)
api_router.include_router(companies.router)
