import uuid

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.database import get_db
from app.models.user import User
from app.schemas.alert import AlertResponse
from app.services import alert_service

router = APIRouter(prefix="/alerts", tags=["Alertas"])


@router.get("", response_model=list[AlertResponse])
def list_alerts(
    unread_only: bool = False,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    return alert_service.get_alerts_for_user(db, current_user.id, current_user.role, unread_only)


@router.get("/unread-count")
def unread_count(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    return {"count": alert_service.count_unread(db, current_user.id, current_user.role)}


@router.patch("/{alert_id}/read")
def mark_read(alert_id: uuid.UUID, db: Session = Depends(get_db), _: User = Depends(get_current_user)):
    alert_service.mark_read(db, alert_id)
    return {"detail": "Alerta marcada como leída."}


@router.patch("/read-all")
def mark_all_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    alert_service.mark_all_read(db, current_user.id, current_user.role)
    return {"detail": "Todas las alertas marcadas como leídas."}
