import uuid
from typing import Any

from sqlalchemy.orm import Session

from app.models.budget_item import BudgetItem
from app.schemas.ai import AiFinding, AiSource
from app.services.ai_tools.common import get_fiscal_year
from app.services.ai_tools.types import ReadOnlyToolContext


def get_budget_context(db: Session, year: int, context: ReadOnlyToolContext) -> dict[str, Any]:
    fiscal_year = get_fiscal_year(db, year, context)
    if not fiscal_year:
        context.add_tool_call("get_budget_summary", {"year": year}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fiscal_year.id)
        .order_by(BudgetItem.number)
        .all()
    )
    total_budget = float(fiscal_year.total_budget)
    total_executed = sum(float(item.executed_amount) for item in items)
    at_risk = [budget_item_payload(item) for item in items if budget_status(item) in {"yellow", "red"}]
    red_items = [item for item in at_risk if item["status_color"] == "red"]
    yellow_items = [item for item in at_risk if item["status_color"] == "yellow"]

    context.sources.append(AiSource(entity_type="fiscal_year", entity_id=fiscal_year.id, label=f"Ano fiscal {year}"))
    for item in at_risk[:5]:
        context.sources.append(
            AiSource(
                entity_type="budget_item",
                entity_id=uuid.UUID(item["id"]),
                label=f"Partida {item['number']} - {item['name']}",
                detail=f"{item['execution_percentage']}% ejecutado",
            )
        )

    if red_items:
        context.findings.append(
            AiFinding(
                code="budget_items_in_red",
                severity="critical",
                message=f"Hay {len(red_items)} partidas en rojo o bloqueadas.",
            )
        )
    if yellow_items:
        context.findings.append(
            AiFinding(
                code="budget_items_in_yellow",
                severity="warning",
                message=f"Hay {len(yellow_items)} partidas entre umbral amarillo y rojo.",
            )
        )
    if fiscal_year.status != "approved":
        context.findings.append(
            AiFinding(
                code="fiscal_year_not_approved",
                severity="warning",
                message="El presupuesto fiscal no esta aprobado; las conclusiones financieras deben tratarse como preliminares.",
            )
        )

    context.add_tool_call(
        "get_budget_summary",
        {"year": year},
        f"{len(items)} partidas, {len(red_items)} en rojo y {len(yellow_items)} en amarillo.",
    )
    return {
        "year": year,
        "fiscal_year_id": str(fiscal_year.id),
        "fiscal_year_status": fiscal_year.status,
        "total_budget": total_budget,
        "total_executed": total_executed,
        "total_available": total_budget - total_executed,
        "execution_percentage": round((total_executed / total_budget) * 100, 1) if total_budget else 0,
        "items_count": len(items),
        "red_items": red_items[:10],
        "yellow_items": yellow_items[:10],
    }


def budget_item_payload(item: BudgetItem) -> dict[str, Any]:
    allocated = float(item.allocated_amount)
    executed = float(item.executed_amount)
    return {
        "id": str(item.id),
        "number": item.number,
        "name": item.name,
        "allocated_amount": allocated,
        "executed_amount": executed,
        "available_amount": allocated - executed,
        "execution_percentage": budget_percentage(item),
        "status_color": budget_status(item),
        "is_blocked": item.is_blocked,
        "fund_source": item.fund_source,
    }


def budget_percentage(item: BudgetItem) -> float:
    allocated = float(item.allocated_amount)
    executed = float(item.executed_amount)
    if allocated == 0:
        return 100 if executed > 0 else 0
    return round((executed / allocated) * 100, 1)


def budget_status(item: BudgetItem) -> str:
    percentage = budget_percentage(item)
    if percentage >= float(item.red_threshold):
        return "red"
    if percentage >= float(item.yellow_threshold):
        return "yellow"
    return "green"
