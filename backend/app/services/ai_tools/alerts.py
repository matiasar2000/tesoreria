from typing import Any

from sqlalchemy.orm import Session

from app.models.alert import Alert
from app.models.user import User
from app.schemas.ai import AiFinding, AiSource
from app.services.ai_tools.types import ReadOnlyToolContext


def get_alerts_context(db: Session, user: User, context: ReadOnlyToolContext) -> dict[str, Any]:
    query = db.query(Alert).filter(
        (Alert.target_user_id == user.id)
        | (Alert.target_role == user.role)
        | (Alert.target_role.is_(None) & Alert.target_user_id.is_(None))
    )
    unread_count = query.filter(Alert.read.is_(False)).count()
    alerts = query.order_by(Alert.created_at.desc()).limit(10).all()
    items = [
        {
            "id": str(alert.id),
            "type": alert.type,
            "severity": alert.severity,
            "title": alert.title,
            "read": alert.read,
            "related_entity_type": alert.related_entity_type,
            "related_entity_id": str(alert.related_entity_id) if alert.related_entity_id else None,
        }
        for alert in alerts
    ]
    for alert in alerts[:5]:
        context.sources.append(
            AiSource(
                entity_type="alert",
                entity_id=alert.id,
                label=alert.title,
                detail=f"Severidad {alert.severity}",
            )
        )
    if unread_count:
        context.findings.append(
            AiFinding(
                code="unread_alerts",
                severity="warning",
                message=f"Hay {unread_count} alertas no leidas para tu alcance.",
            )
        )

    context.add_tool_call("get_alerts", {"unread_only": False}, f"{len(alerts)} alertas consultadas.")
    return {"count": len(alerts), "unread_count": unread_count, "items": items}
