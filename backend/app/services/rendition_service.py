import uuid
from datetime import datetime, timezone

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.expense import Expense
from app.models.rendition import Rendition, RenditionItem
from app.models.user import User
from app.schemas.rendition import RenditionCreate, RenditionItemResponse, RenditionResponse


def _item_response(item: RenditionItem) -> RenditionItemResponse:
    exp = item.expense
    return RenditionItemResponse(
        id=item.id,
        expense_id=item.expense_id,
        expense_description=exp.description if exp else None,
        expense_amount=float(exp.amount) if exp else None,
        expense_date=exp.expense_date if exp else None,
        expense_supplier=exp.supplier_name if exp else None,
    )


def _to_response(rendition: Rendition) -> RenditionResponse:
    return RenditionResponse(
        id=rendition.id,
        fiscal_year_id=rendition.fiscal_year_id,
        company_id=rendition.company_id,
        company_name=rendition.company.name if rendition.company else None,
        period_start=rendition.period_start,
        period_end=rendition.period_end,
        total_amount=float(rendition.total_amount),
        status=rendition.status,
        notes=rendition.notes,
        submitted_by_name=rendition.submitted_by.full_name if rendition.submitted_by else None,
        approved_by_name=rendition.approved_by.full_name if rendition.approved_by else None,
        submitted_at=rendition.submitted_at,
        approved_at=rendition.approved_at,
        created_at=rendition.created_at,
        items=[_item_response(i) for i in rendition.items],
    )


def create_rendition(db: Session, data: RenditionCreate, current_user: User) -> RenditionResponse:
    expenses = (
        db.query(Expense)
        .filter(
            Expense.fiscal_year_id == data.fiscal_year_id,
            Expense.company_id == data.company_id,
            Expense.status == "approved",
            Expense.expense_date >= data.period_start,
            Expense.expense_date <= data.period_end,
        )
        .all()
    )

    total = sum(float(e.amount) for e in expenses)

    rendition = Rendition(
        fiscal_year_id=data.fiscal_year_id,
        company_id=data.company_id,
        period_start=data.period_start,
        period_end=data.period_end,
        total_amount=total,
        status="draft",
        notes=data.notes,
    )
    db.add(rendition)
    db.flush()

    for expense in expenses:
        db.add(RenditionItem(rendition_id=rendition.id, expense_id=expense.id))

    db.commit()
    db.refresh(rendition)
    return _to_response(rendition)


def get_renditions(
    db: Session,
    fiscal_year_id: uuid.UUID | None = None,
    company_id: uuid.UUID | None = None,
    rendition_status: str | None = None,
) -> list[RenditionResponse]:
    query = db.query(Rendition)
    if fiscal_year_id:
        query = query.filter(Rendition.fiscal_year_id == fiscal_year_id)
    if company_id:
        query = query.filter(Rendition.company_id == company_id)
    if rendition_status:
        query = query.filter(Rendition.status == rendition_status)
    renditions = query.order_by(Rendition.created_at.desc()).all()
    return [_to_response(r) for r in renditions]


def get_rendition(db: Session, rendition_id: uuid.UUID) -> RenditionResponse:
    rendition = db.query(Rendition).filter(Rendition.id == rendition_id).first()
    if not rendition:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rendicion no encontrada.")
    return _to_response(rendition)


def submit_rendition(db: Session, rendition_id: uuid.UUID, user: User) -> RenditionResponse:
    rendition = db.query(Rendition).filter(Rendition.id == rendition_id).first()
    if not rendition:
        raise HTTPException(status_code=404, detail="Rendicion no encontrada.")
    if rendition.status != "draft":
        raise HTTPException(status_code=400, detail="Solo se pueden enviar rendiciones en borrador.")

    rendition.status = "submitted"
    rendition.submitted_by_id = user.id
    rendition.submitted_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rendition)
    return _to_response(rendition)


def approve_rendition(db: Session, rendition_id: uuid.UUID, user: User) -> RenditionResponse:
    rendition = db.query(Rendition).filter(Rendition.id == rendition_id).first()
    if not rendition:
        raise HTTPException(status_code=404, detail="Rendicion no encontrada.")
    if rendition.status != "submitted":
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar rendiciones enviadas.")

    rendition.status = "approved"
    rendition.approved_by_id = user.id
    rendition.approved_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(rendition)
    return _to_response(rendition)


def reject_rendition(db: Session, rendition_id: uuid.UUID, reason: str | None = None) -> RenditionResponse:
    rendition = db.query(Rendition).filter(Rendition.id == rendition_id).first()
    if not rendition:
        raise HTTPException(status_code=404, detail="Rendicion no encontrada.")
    if rendition.status != "submitted":
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar rendiciones enviadas.")

    rendition.status = "rejected"
    if reason:
        rendition.notes = f"[Rechazada] {reason}" if not rendition.notes else f"{rendition.notes}\n[Rechazada] {reason}"
    db.commit()
    db.refresh(rendition)
    return _to_response(rendition)
