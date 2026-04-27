from typing import Any

from sqlalchemy.orm import Session

from app.models.rendition import Rendition
from app.models.user import User
from app.schemas.ai import AiFinding, AiSource
from app.services.ai_tools.common import get_fiscal_year
from app.services.ai_tools.types import ReadOnlyToolContext


def get_rendition_context(
    db: Session,
    year: int,
    user: User,
    context: ReadOnlyToolContext,
) -> dict[str, Any]:
    fiscal_year = get_fiscal_year(db, year, context)
    if not fiscal_year:
        context.add_tool_call("get_rendition_status", {"year": year}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    query = db.query(Rendition).filter(Rendition.fiscal_year_id == fiscal_year.id)
    if user.role == "director_compania" and user.company_id:
        query = query.filter(Rendition.company_id == user.company_id)
    renditions = query.order_by(Rendition.created_at.desc()).limit(20).all()

    by_status: dict[str, int] = {}
    items: list[dict[str, Any]] = []
    for rendition in renditions:
        by_status[rendition.status] = by_status.get(rendition.status, 0) + 1
        items.append(
            {
                "id": str(rendition.id),
                "company_id": str(rendition.company_id),
                "company_name": rendition.company.name if rendition.company else None,
                "status": rendition.status,
                "period_start": rendition.period_start.isoformat(),
                "period_end": rendition.period_end.isoformat(),
                "total_amount": float(rendition.total_amount),
            }
        )
        context.sources.append(
            AiSource(
                entity_type="rendition",
                entity_id=rendition.id,
                label=rendition.company.name if rendition.company else "Rendicion",
                detail=f"Estado {rendition.status}",
            )
        )
    pending_statuses = by_status.get("draft", 0) + by_status.get("submitted", 0)
    if pending_statuses:
        context.findings.append(
            AiFinding(
                code="renditions_pending",
                severity="warning",
                message=f"Hay {pending_statuses} rendiciones en borrador o enviadas.",
            )
        )

    context.add_tool_call("get_rendition_status", {"year": year}, f"{len(renditions)} rendiciones consultadas.")
    return {"year": year, "count": len(renditions), "by_status": by_status, "items": items}
