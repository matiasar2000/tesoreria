import uuid
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import BudgetItemBlocked, InsufficientBudget
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.models.user import User
from app.schemas.expense import ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services import alert_service, budget_service


def _to_response(expense: Expense) -> ExpenseResponse:
    data = {c.name: getattr(expense, c.name) for c in expense.__table__.columns}
    data["budget_item_name"] = expense.budget_item.name if expense.budget_item else None
    data["requested_by_name"] = expense.requested_by.full_name if expense.requested_by else None
    return ExpenseResponse(**data)


def create_expense(db: Session, data: ExpenseCreate, current_user: User) -> ExpenseResponse:
    item = budget_service.get_budget_item(db, data.budget_item_id)

    if item.is_blocked:
        raise BudgetItemBlocked(item.name)

    available = float(item.allocated_amount) - float(item.executed_amount)
    if data.amount > available:
        raise InsufficientBudget(item.name, int(available), int(data.amount))

    requires_quotations = data.amount > 1_000_000

    expense = Expense(
        budget_item_id=data.budget_item_id,
        fiscal_year_id=item.fiscal_year_id,
        company_id=data.company_id,
        amount=data.amount,
        description=data.description,
        supplier_rut=data.supplier_rut,
        supplier_name=data.supplier_name,
        invoice_number=data.invoice_number,
        expense_date=data.expense_date,
        status="pending_approval",
        requires_quotations=requires_quotations,
        authorized_by_superintendent=data.authorized_by_superintendent,
        requested_by_id=current_user.id,
        notes=data.notes,
    )
    db.add(expense)

    if data.authorized_by_superintendent:
        fy = db.query(FiscalYear).filter(FiscalYear.id == item.fiscal_year_id).first()
        imm = float(fy.imm_value) if fy else 500000
        limit = imm * 5
        if data.amount > limit:
            alert_service.create_alert(
                db,
                alert_type="superintendent_limit",
                severity="critical",
                title="Gasto supera límite del Superintendente",
                message=(
                    f"Gasto de ${int(data.amount):,} supera el límite de "
                    f"${int(limit):,} (5 IMM). Requiere aprobación del Directorio."
                ).replace(",", "."),
                target_role="directorio",
                related_entity_type="expense",
                related_entity_id=expense.id,
            )

    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def approve_expense(db: Session, expense_id: uuid.UUID, approver: User) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    if expense.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Solo se pueden aprobar gastos pendientes de aprobación.")

    item = budget_service.get_budget_item(db, expense.budget_item_id)
    if item.is_blocked:
        raise BudgetItemBlocked(item.name)
    available = float(item.allocated_amount) - float(item.executed_amount)
    if expense.amount > available:
        raise InsufficientBudget(item.name, int(available), int(expense.amount))

    expense.status = "approved"
    expense.approved_by_id = approver.id

    item.executed_amount = Decimal(str(item.executed_amount)) + Decimal(str(expense.amount))
    budget_service.check_auto_block(db, item)
    _generate_budget_alerts(db, item)

    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def reject_expense(db: Session, expense_id: uuid.UUID, approver: User, reason: str | None = None) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    if expense.status != "pending_approval":
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar gastos pendientes de aprobación.")

    expense.status = "rejected"
    expense.approved_by_id = approver.id
    if reason:
        expense.notes = f"[Rechazado] {reason}" if not expense.notes else f"{expense.notes}\n[Rechazado] {reason}"

    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def void_expense(db: Session, expense_id: uuid.UUID) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    if expense.status == "voided":
        raise HTTPException(status_code=400, detail="El gasto ya está anulado.")

    if expense.status == "approved":
        item = budget_service.get_budget_item(db, expense.budget_item_id)
        item.executed_amount = Decimal(str(item.executed_amount)) - Decimal(str(expense.amount))
        if item.is_blocked:
            pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100 if item.allocated_amount else 0
            if pct < float(item.red_threshold):
                item.is_blocked = False

    expense.status = "voided"
    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def _generate_budget_alerts(db: Session, item) -> None:
    if item.allocated_amount == 0:
        return
    pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100
    if pct >= float(item.red_threshold):
        alert_service.create_alert(
            db,
            alert_type="budget_red",
            severity="critical",
            title=f"Partida '{item.name}' en rojo",
            message=f"La partida #{item.number} '{item.name}' ha alcanzado {pct:.1f}% de ejecución.",
            target_role="tesorero",
            related_entity_type="budget_item",
            related_entity_id=item.id,
        )
    elif pct >= float(item.yellow_threshold):
        alert_service.create_alert(
            db,
            alert_type="budget_yellow",
            severity="warning",
            title=f"Partida '{item.name}' en amarillo",
            message=f"La partida #{item.number} '{item.name}' ha alcanzado {pct:.1f}% de ejecución.",
            target_role="tesorero",
            related_entity_type="budget_item",
            related_entity_id=item.id,
        )


def get_expenses(
    db: Session,
    fiscal_year_id: uuid.UUID | None = None,
    budget_item_id: uuid.UUID | None = None,
    expense_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[ExpenseResponse], int]:
    query = db.query(Expense)
    if fiscal_year_id:
        query = query.filter(Expense.fiscal_year_id == fiscal_year_id)
    if budget_item_id:
        query = query.filter(Expense.budget_item_id == budget_item_id)
    if expense_status:
        query = query.filter(Expense.status == expense_status)

    total = query.count()
    expenses = query.order_by(Expense.expense_date.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return [_to_response(e) for e in expenses], total


def get_expense(db: Session, expense_id: uuid.UUID) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gasto no encontrado.")
    return _to_response(expense)


def update_expense(db: Session, expense_id: uuid.UUID, data: ExpenseUpdate) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gasto no encontrado.")
    if expense.status != "draft":
        raise HTTPException(status_code=400, detail="Solo se pueden editar gastos en borrador.")
    update_data = data.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)
    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def delete_expense(db: Session, expense_id: uuid.UUID) -> None:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Gasto no encontrado.")

    if expense.status == "approved":
        item = budget_service.get_budget_item(db, expense.budget_item_id)
        item.executed_amount = Decimal(str(item.executed_amount)) - Decimal(str(expense.amount))
        if item.is_blocked:
            pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100 if item.allocated_amount else 0
            if pct < float(item.red_threshold):
                item.is_blocked = False

    db.delete(expense)
    db.commit()
