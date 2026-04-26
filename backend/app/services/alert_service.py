import uuid

from sqlalchemy.orm import Session

from app.models.alert import Alert


def create_alert(
    db: Session,
    *,
    alert_type: str,
    severity: str,
    title: str,
    message: str,
    target_user_id: uuid.UUID | None = None,
    target_role: str | None = None,
    related_entity_type: str | None = None,
    related_entity_id: uuid.UUID | None = None,
) -> Alert:
    alert = Alert(
        type=alert_type,
        severity=severity,
        title=title,
        message=message,
        target_user_id=target_user_id,
        target_role=target_role,
        related_entity_type=related_entity_type,
        related_entity_id=related_entity_id,
    )
    db.add(alert)
    db.flush()
    return alert


def get_alerts_for_user(db: Session, user_id: uuid.UUID, user_role: str, unread_only: bool = False) -> list[Alert]:
    query = db.query(Alert).filter(
        (Alert.target_user_id == user_id) | (Alert.target_role == user_role) | (Alert.target_role.is_(None) & Alert.target_user_id.is_(None))
    )
    if unread_only:
        query = query.filter(Alert.read == False)  # noqa: E712
    return query.order_by(Alert.created_at.desc()).limit(50).all()


def count_unread(db: Session, user_id: uuid.UUID, user_role: str) -> int:
    return (
        db.query(Alert)
        .filter(
            (Alert.target_user_id == user_id) | (Alert.target_role == user_role) | (Alert.target_role.is_(None) & Alert.target_user_id.is_(None))
        )
        .filter(Alert.read == False)  # noqa: E712
        .count()
    )


def mark_read(db: Session, alert_id: uuid.UUID) -> None:
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if alert:
        alert.read = True
        db.commit()


def mark_all_read(db: Session, user_id: uuid.UUID, user_role: str) -> None:
    db.query(Alert).filter(
        (Alert.target_user_id == user_id) | (Alert.target_role == user_role) | (Alert.target_role.is_(None) & Alert.target_user_id.is_(None))
    ).filter(Alert.read == False).update({"read": True})  # noqa: E712
    db.commit()
