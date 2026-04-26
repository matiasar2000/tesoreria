import uuid
from datetime import datetime, timezone
from decimal import Decimal

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.core.exceptions import BudgetItemBlocked, InsufficientBudget
from app.models.approval_step import ApprovalStep
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.models.user import User
from app.schemas.expense import ApprovalStepBrief, ExpenseCreate, ExpenseResponse, ExpenseUpdate
from app.services import alert_service, budget_service


PENDING_STATUSES = {"pending_review", "pending_approval", "pending_directorio"}

STATUS_FOR_STEP_ROLE = {
    "equipo_tesoreria": "pending_review",
    "tesorero": "pending_approval",
    "directorio": "pending_directorio",
}


def _step_brief(step: ApprovalStep) -> ApprovalStepBrief:
    return ApprovalStepBrief(
        id=step.id,
        step_order=step.step_order,
        role_required=step.role_required,
        label=step.label,
        status=step.status,
        acted_by_name=step.acted_by.full_name if step.acted_by else None,
        acted_at=step.acted_at,
    )


def _to_response(expense: Expense) -> ExpenseResponse:
    data = {c.name: getattr(expense, c.name) for c in expense.__table__.columns}
    data["budget_item_name"] = expense.budget_item.name if expense.budget_item else None
    data["requested_by_name"] = expense.requested_by.full_name if expense.requested_by else None
    data["approval_steps"] = [_step_brief(s) for s in expense.approval_steps]
    return ExpenseResponse(**data)


def _get_imm_limit(db: Session, fiscal_year_id: uuid.UUID) -> float:
    fy = db.query(FiscalYear).filter(FiscalYear.id == fiscal_year_id).first()
    imm = float(fy.imm_value) if fy else 500_000
    return imm * 5


def _build_approval_steps(db: Session, expense: Expense) -> None:
    steps = [
        ApprovalStep(
            expense_id=expense.id,
            step_order=1,
            role_required="equipo_tesoreria",
            label="Revisión Equipo Tesorería",
            status="pending",
        ),
        ApprovalStep(
            expense_id=expense.id,
            step_order=2,
            role_required="tesorero",
            label="Aprobación Tesorero",
            status="pending",
        ),
    ]

    limit = _get_imm_limit(db, expense.fiscal_year_id)
    if float(expense.amount) > limit:
        steps.append(
            ApprovalStep(
                expense_id=expense.id,
                step_order=3,
                role_required="directorio",
                label="Aprobación Directorio",
                status="pending",
            )
        )

    for s in steps:
        db.add(s)
    db.flush()


def _current_pending_step(expense: Expense) -> ApprovalStep | None:
    for step in sorted(expense.approval_steps, key=lambda s: s.step_order):
        if step.status == "pending":
            return step
    return None


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
        status="pending_review",
        requires_quotations=requires_quotations,
        authorized_by_superintendent=data.authorized_by_superintendent,
        requested_by_id=current_user.id,
        notes=data.notes,
    )
    db.add(expense)
    db.flush()

    _build_approval_steps(db, expense)

    if data.authorized_by_superintendent:
        limit = _get_imm_limit(db, item.fiscal_year_id)
        if data.amount > limit:
            alert_service.create_alert(
                db,
                alert_type="superintendent_limit",
                severity="critical",
                title="Gasto supera limite del Superintendente",
                message=(
                    f"Gasto de ${int(data.amount):,} supera el limite de "
                    f"${int(limit):,} (5 IMM). Requiere aprobacion del Directorio."
                ).replace(",", "."),
                target_role="directorio",
                related_entity_type="expense",
                related_entity_id=expense.id,
            )

    db.commit()
    db.refresh(expense)
    return _to_response(expense)


def _advance_to_next_step(expense: Expense) -> str:
    pending = [s for s in expense.approval_steps if s.status == "pending"]
    if pending:
        next_step = min(pending, key=lambda s: s.step_order)
        return STATUS_FOR_STEP_ROLE.get(next_step.role_required, "pending_approval")
    return "approved"


def advance_approval(db: Session, expense_id: uuid.UUID, approver: User, notes: str | None = None) -> ExpenseResponse:
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=404, detail="Gasto no encontrado.")
    if expense.status not in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="Este gasto no tiene aprobaciones pendientes.")

    step = _current_pending_step(expense)
    if not step:
        raise HTTPException(status_code=400, detail="No hay pasos de aprobacion pendientes.")

    allowed_roles = {step.role_required}
    if step.role_required == "equipo_tesoreria":
        allowed_roles.add("tesorero")
    if approver.role not in allowed_roles:
        raise HTTPException(
            status_code=403,
            detail=f"Se requiere rol '{step.role_required}' para este paso. Tu rol: '{approver.role}'.",
        )

    item = budget_service.get_budget_item(db, expense.budget_item_id)
    if item.is_blocked:
        raise BudgetItemBlocked(item.name)
    available = float(item.allocated_amount) - float(item.executed_amount)
    if float(expense.amount) > available:
        raise InsufficientBudget(item.name, int(available), int(expense.amount))

    step.status = "approved"
    step.acted_by_id = approver.id
    step.acted_at = datetime.now(timezone.utc)
    if notes:
        step.notes = notes

    new_status = _advance_to_next_step(expense)
    expense.status = new_status

    if new_status == "approved":
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
    if expense.status not in PENDING_STATUSES:
        raise HTTPException(status_code=400, detail="Solo se pueden rechazar gastos con aprobacion pendiente.")

    step = _current_pending_step(expense)
    if step:
        step.status = "rejected"
        step.acted_by_id = approver.id
        step.acted_at = datetime.now(timezone.utc)
        if reason:
            step.notes = reason
        for s in expense.approval_steps:
            if s.status == "pending" and s.id != step.id:
                s.status = "skipped"

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
        raise HTTPException(status_code=400, detail="El gasto ya esta anulado.")

    if expense.status == "approved":
        item = budget_service.get_budget_item(db, expense.budget_item_id)
        item.executed_amount = Decimal(str(item.executed_amount)) - Decimal(str(expense.amount))
        if item.is_blocked:
            pct = (float(item.executed_amount) / float(item.allocated_amount)) * 100 if item.allocated_amount else 0
            if pct < float(item.red_threshold):
                item.is_blocked = False

    for step in expense.approval_steps:
        if step.status == "pending":
            step.status = "skipped"

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
            message=f"La partida #{item.number} '{item.name}' ha alcanzado {pct:.1f}% de ejecucion.",
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
            message=f"La partida #{item.number} '{item.name}' ha alcanzado {pct:.1f}% de ejecucion.",
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
