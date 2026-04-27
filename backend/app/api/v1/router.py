from fastapi import APIRouter

from app.api.v1 import ai, alerts, assets, auth, bank, budget_items, companies, dashboard, documents, expenses, exports, fiscal_close, fiscal_years, imports, incomes, renditions, reports, users

api_router = APIRouter(prefix="/api/v1")

api_router.include_router(auth.router)
api_router.include_router(users.router)
api_router.include_router(assets.router)
api_router.include_router(fiscal_years.router)
api_router.include_router(budget_items.direct_router)
api_router.include_router(budget_items.router)
api_router.include_router(expenses.router)
api_router.include_router(incomes.router)
api_router.include_router(documents.router)
api_router.include_router(exports.router)
api_router.include_router(alerts.router)
api_router.include_router(dashboard.router)
api_router.include_router(imports.router)
api_router.include_router(companies.router)
api_router.include_router(bank.router)
api_router.include_router(renditions.router)
api_router.include_router(fiscal_close.router)
api_router.include_router(reports.router)
api_router.include_router(ai.router)
