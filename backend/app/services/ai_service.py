import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.ai_run import AiRun
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.budget_item import BudgetItem
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.models.rendition import Rendition
from app.models.user import User
from app.schemas.ai import (
    AiFinding,
    AiProposedAction,
    AiQueryRequest,
    AiQueryResponse,
    AiRunListItem,
    AiRunResponse,
    AiSource,
    AiToolCall,
)
from app.schemas.common import PaginatedResponse

BANK_ROLES = {"tesorero", "equipo_tesoreria"}
TREASURY_ROLES = {"tesorero", "equipo_tesoreria", "superintendente", "directorio"}
PENDING_EXPENSE_STATUSES = ["pending_review", "pending_approval", "pending_directorio"]


def run_read_only_query(db: Session, data: AiQueryRequest, current_user: User) -> AiQueryResponse:
    year = data.year or date.today().year
    thread_id = data.thread_id or uuid.uuid4()
    trace: list[dict[str, Any]] = []
    tool_calls: list[AiToolCall] = []
    findings: list[AiFinding] = []
    sources: list[AiSource] = []
    proposed_actions: list[AiProposedAction] = []

    run = AiRun(
        thread_id=thread_id,
        user_id=current_user.id,
        status="iniciado",
        input_payload={"question": data.question, "year": year},
        user_context=_build_user_context(current_user),
        policy_context=_build_policy_context(),
    )
    db.add(run)
    db.flush()

    _trace(trace, "receive_request", "completed")
    intent = _classify_intent(data.question)
    run.intent = intent
    run.status = "autorizando"
    _trace(trace, "authorize_scope", "completed")

    blocking_finding = _get_blocking_finding(intent, current_user)
    if blocking_finding:
        findings.append(blocking_finding)
        answer = blocking_finding.message
        run.status = "bloqueado"
        run.findings = _dump_findings(findings)
        run.final_response = answer
        run.confidence = 1
        run.audit_trace = trace
        run.completed_at = datetime.now(timezone.utc)
        _create_audit_log(db, run, current_user)
        db.commit()
        return _to_query_response(run, sources, findings, proposed_actions, tool_calls)

    run.status = "contextualizando"
    _trace(trace, "classify_intent", "completed", {"intent": intent})
    domain_context = _retrieve_context(db, intent, year, current_user, tool_calls, sources, findings)

    run.status = "analizando"
    _trace(trace, "retrieve_context", "completed", {"tools": [call.name for call in tool_calls]})
    answer, confidence, proposed_actions = _draft_answer(intent, domain_context, year, findings)
    _trace(trace, "draft_answer", "completed", {"confidence": confidence})

    run.status = "finalizado"
    run.domain_context = domain_context
    run.tool_calls = _dump_tool_calls(tool_calls)
    run.findings = _dump_findings(findings)
    run.confidence = confidence
    run.proposed_actions = _dump_actions(proposed_actions)
    run.final_response = answer
    run.audit_trace = trace
    run.completed_at = datetime.now(timezone.utc)

    _create_audit_log(db, run, current_user)
    db.commit()
    db.refresh(run)
    return _to_query_response(run, sources, findings, proposed_actions, tool_calls)


def get_ai_run(db: Session, run_id: uuid.UUID, current_user: User) -> AiRunResponse:
    run = db.query(AiRun).filter(AiRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida IA no encontrada.")
    if run.user_id != current_user.id and current_user.role not in TREASURY_ROLES:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para ver esta corrida IA.")
    return AiRunResponse.model_validate(run)


def list_ai_runs(
    db: Session,
    current_user: User,
    *,
    intent: str | None = None,
    run_status: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> PaginatedResponse[AiRunListItem]:
    query = db.query(AiRun)
    if current_user.role not in TREASURY_ROLES:
        query = query.filter(AiRun.user_id == current_user.id)
    if intent:
        query = query.filter(AiRun.intent == intent)
    if run_status:
        query = query.filter(AiRun.status == run_status)

    total = query.count()
    runs = query.order_by(AiRun.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    items = [_to_run_list_item(run) for run in runs]
    pages = (total + page_size - 1) // page_size
    return PaginatedResponse(items=items, total=total, page=page, page_size=page_size, pages=pages)


def _build_user_context(user: User) -> dict[str, Any]:
    scopes = ["budget:read", "expenses:read", "alerts:read", "renditions:read"]
    if user.role in BANK_ROLES:
        scopes.append("bank:read")
    return {
        "user_id": str(user.id),
        "role": user.role,
        "company_id": str(user.company_id) if user.company_id else None,
        "scopes": scopes,
    }


def _build_policy_context() -> dict[str, Any]:
    return {
        "mode": "read_only",
        "writes_allowed": False,
        "guardrails": [
            "no_financial_writes",
            "role_filtered_tools",
            "source_based_answers",
            "human_review_required_for_sensitive_actions",
        ],
    }


def _classify_intent(question: str) -> str:
    normalized = question.lower()
    if any(word in normalized for word in ["banco", "cartola", "conciliacion", "conciliar", "movimiento"]):
        return "bank_reconciliation"
    if any(word in normalized for word in ["rendicion", "rendiciones", "rendir"]):
        return "rendition_status"
    if "5 imm" in normalized or "imm" in normalized or "superintendente" in normalized:
        return "expenses_over_imm"
    if any(word in normalized for word in ["pendiente", "aprobacion", "aprobar", "revision"]):
        return "pending_expenses"
    if any(word in normalized for word in ["alerta", "alertas", "riesgo"]):
        return "alerts"
    if any(word in normalized for word in ["presupuesto", "partida", "disponible", "ejecutado", "rojo", "amarillo"]):
        return "budget_status"
    return "overview"


def _get_blocking_finding(intent: str, user: User) -> AiFinding | None:
    if intent == "bank_reconciliation" and user.role not in BANK_ROLES:
        return AiFinding(
            code="bank_scope_denied",
            severity="blocked",
            message="No puedo consultar informacion bancaria con el rol actual. Se requiere tesorero o equipo_tesoreria.",
        )
    return None


def _retrieve_context(
    db: Session,
    intent: str,
    year: int,
    user: User,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    if intent == "budget_status":
        return {"budget": _get_budget_context(db, year, tool_calls, sources, findings)}
    if intent == "pending_expenses":
        return {"pending_expenses": _get_pending_expenses_context(db, year, user, tool_calls, sources, findings)}
    if intent == "expenses_over_imm":
        return {"expenses_over_imm": _get_large_expenses_context(db, year, user, tool_calls, sources, findings)}
    if intent == "bank_reconciliation":
        return {"bank": _get_bank_context(db, tool_calls, sources, findings)}
    if intent == "rendition_status":
        return {"renditions": _get_rendition_context(db, year, user, tool_calls, sources, findings)}
    if intent == "alerts":
        return {"alerts": _get_alerts_context(db, user, tool_calls, sources, findings)}

    context: dict[str, Any] = {
        "budget": _get_budget_context(db, year, tool_calls, sources, findings),
        "pending_expenses": _get_pending_expenses_context(db, year, user, tool_calls, sources, findings),
        "alerts": _get_alerts_context(db, user, tool_calls, sources, findings),
        "renditions": _get_rendition_context(db, year, user, tool_calls, sources, findings),
    }
    if user.role in BANK_ROLES:
        context["bank"] = _get_bank_context(db, tool_calls, sources, findings)
    return context


def _get_fiscal_year(db: Session, year: int, findings: list[AiFinding]) -> FiscalYear | None:
    fiscal_year = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    if not fiscal_year:
        findings.append(
            AiFinding(
                code="fiscal_year_not_found",
                severity="warning",
                message=f"No hay ano fiscal cargado para {year}.",
            )
        )
    return fiscal_year


def _get_budget_context(
    db: Session,
    year: int,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    fiscal_year = _get_fiscal_year(db, year, findings)
    if not fiscal_year:
        _add_tool_call(tool_calls, "get_budget_summary", {"year": year}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.fiscal_year_id == fiscal_year.id)
        .order_by(BudgetItem.number)
        .all()
    )
    total_budget = float(fiscal_year.total_budget)
    total_executed = sum(float(item.executed_amount) for item in items)
    at_risk = [_budget_item_payload(item) for item in items if _budget_status(item) in {"yellow", "red"}]
    red_items = [item for item in at_risk if item["status_color"] == "red"]
    yellow_items = [item for item in at_risk if item["status_color"] == "yellow"]

    sources.append(AiSource(entity_type="fiscal_year", entity_id=fiscal_year.id, label=f"Ano fiscal {year}"))
    for item in at_risk[:5]:
        sources.append(
            AiSource(
                entity_type="budget_item",
                entity_id=uuid.UUID(item["id"]),
                label=f"Partida {item['number']} - {item['name']}",
                detail=f"{item['execution_percentage']}% ejecutado",
            )
        )

    if red_items:
        findings.append(
            AiFinding(
                code="budget_items_in_red",
                severity="critical",
                message=f"Hay {len(red_items)} partidas en rojo o bloqueadas.",
            )
        )
    if yellow_items:
        findings.append(
            AiFinding(
                code="budget_items_in_yellow",
                severity="warning",
                message=f"Hay {len(yellow_items)} partidas entre umbral amarillo y rojo.",
            )
        )
    if fiscal_year.status != "approved":
        findings.append(
            AiFinding(
                code="fiscal_year_not_approved",
                severity="warning",
                message="El presupuesto fiscal no esta aprobado; las conclusiones financieras deben tratarse como preliminares.",
            )
        )

    _add_tool_call(
        tool_calls,
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


def _get_pending_expenses_context(
    db: Session,
    year: int,
    user: User,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    fiscal_year = _get_fiscal_year(db, year, findings)
    if not fiscal_year:
        _add_tool_call(tool_calls, "search_expenses", {"year": year, "status": "pending"}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    query = db.query(Expense).filter(
        Expense.fiscal_year_id == fiscal_year.id,
        Expense.status.in_(PENDING_EXPENSE_STATUSES),
    )
    if user.role == "director_compania" and user.company_id:
        query = query.filter(Expense.company_id == user.company_id)

    total_amount = float(query.with_entities(func.coalesce(func.sum(Expense.amount), 0)).scalar() or 0)
    total_count = query.count()
    expenses = query.order_by(Expense.expense_date.desc()).limit(10).all()
    items = [_expense_payload(expense) for expense in expenses]
    for expense in expenses[:5]:
        sources.append(
            AiSource(
                entity_type="expense",
                entity_id=expense.id,
                label=expense.description,
                detail=f"Estado {expense.status}, monto {_format_currency(float(expense.amount))}",
            )
        )
    if total_count:
        findings.append(
            AiFinding(
                code="pending_expenses_found",
                severity="warning",
                message=f"Hay {total_count} gastos pendientes por {_format_currency(total_amount)}.",
            )
        )

    _add_tool_call(tool_calls, "search_expenses", {"year": year, "status": "pending"}, f"{total_count} pendientes.")
    return {"year": year, "count": total_count, "total_amount": total_amount, "items": items}


def _get_large_expenses_context(
    db: Session,
    year: int,
    user: User,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    fiscal_year = _get_fiscal_year(db, year, findings)
    if not fiscal_year:
        _add_tool_call(tool_calls, "search_expenses", {"year": year, "threshold": "5 IMM"}, "Sin ano fiscal.")
        return {"year": year, "items": []}

    limit = float(fiscal_year.imm_value) * 5
    query = db.query(Expense).filter(Expense.fiscal_year_id == fiscal_year.id, Expense.amount > limit)
    if user.role == "director_compania" and user.company_id:
        query = query.filter(Expense.company_id == user.company_id)
    expenses = query.order_by(Expense.amount.desc()).limit(10).all()
    items = [_expense_payload(expense) for expense in expenses]

    for expense in expenses[:5]:
        sources.append(
            AiSource(
                entity_type="expense",
                entity_id=expense.id,
                label=expense.description,
                detail=f"Sobre 5 IMM ({_format_currency(limit)}).",
            )
        )
    if expenses:
        findings.append(
            AiFinding(
                code="expenses_over_imm",
                severity="warning",
                message=f"Hay {len(expenses)} gastos sobre 5 IMM en la muestra consultada.",
            )
        )

    _add_tool_call(
        tool_calls,
        "search_expenses",
        {"year": year, "amount_gt": limit},
        f"{len(expenses)} gastos encontrados sobre 5 IMM.",
    )
    return {"year": year, "imm_value": float(fiscal_year.imm_value), "limit_5_imm": limit, "items": items}


def _get_bank_context(
    db: Session,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    total_transactions = db.query(BankTransaction).count()
    reconciled = db.query(BankTransaction).filter(BankTransaction.reconciled == True).count()  # noqa: E712
    pending = total_transactions - reconciled
    accounts = db.query(BankAccount).filter(BankAccount.is_active.is_(True)).order_by(BankAccount.alias).all()
    account_payload = [
        {"id": str(account.id), "alias": account.alias, "bank_name": account.bank_name, "balance": float(account.balance)}
        for account in accounts
    ]
    total_balance = sum(account["balance"] for account in account_payload)

    for account in accounts[:5]:
        sources.append(
            AiSource(
                entity_type="bank_account",
                entity_id=account.id,
                label=account.alias,
                detail=f"Saldo {_format_currency(float(account.balance))}",
            )
        )
    if pending:
        findings.append(
            AiFinding(
                code="unreconciled_bank_transactions",
                severity="warning",
                message=f"Hay {pending} movimientos bancarios sin conciliar.",
            )
        )

    _add_tool_call(tool_calls, "get_bank_transactions", {"reconciled": "summary"}, f"{pending} sin conciliar.")
    return {
        "total_transactions": total_transactions,
        "reconciled": reconciled,
        "pending": pending,
        "reconciliation_percentage": round((reconciled / total_transactions) * 100, 1) if total_transactions else 0,
        "total_balance": total_balance,
        "accounts": account_payload,
    }


def _get_rendition_context(
    db: Session,
    year: int,
    user: User,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    fiscal_year = _get_fiscal_year(db, year, findings)
    if not fiscal_year:
        _add_tool_call(tool_calls, "get_rendition_status", {"year": year}, "Sin ano fiscal.")
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
        sources.append(
            AiSource(
                entity_type="rendition",
                entity_id=rendition.id,
                label=rendition.company.name if rendition.company else "Rendicion",
                detail=f"Estado {rendition.status}",
            )
        )
    pending_statuses = by_status.get("draft", 0) + by_status.get("submitted", 0)
    if pending_statuses:
        findings.append(
            AiFinding(
                code="renditions_pending",
                severity="warning",
                message=f"Hay {pending_statuses} rendiciones en borrador o enviadas.",
            )
        )

    _add_tool_call(tool_calls, "get_rendition_status", {"year": year}, f"{len(renditions)} rendiciones consultadas.")
    return {"year": year, "count": len(renditions), "by_status": by_status, "items": items}


def _get_alerts_context(
    db: Session,
    user: User,
    tool_calls: list[AiToolCall],
    sources: list[AiSource],
    findings: list[AiFinding],
) -> dict[str, Any]:
    query = db.query(Alert).filter(
        (Alert.target_user_id == user.id)
        | (Alert.target_role == user.role)
        | (Alert.target_role.is_(None) & Alert.target_user_id.is_(None))
    )
    unread_count = query.filter(Alert.read == False).count()  # noqa: E712
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
        sources.append(
            AiSource(
                entity_type="alert",
                entity_id=alert.id,
                label=alert.title,
                detail=f"Severidad {alert.severity}",
            )
        )
    if unread_count:
        findings.append(
            AiFinding(
                code="unread_alerts",
                severity="warning",
                message=f"Hay {unread_count} alertas no leidas para tu alcance.",
            )
        )

    _add_tool_call(tool_calls, "get_alerts", {"unread_only": False}, f"{len(alerts)} alertas consultadas.")
    return {"count": len(alerts), "unread_count": unread_count, "items": items}


def _draft_answer(
    intent: str,
    context: dict[str, Any],
    year: int,
    findings: list[AiFinding],
) -> tuple[str, float, list[AiProposedAction]]:
    if any(finding.severity == "blocked" for finding in findings):
        return "La consulta fue bloqueada por politica de acceso.", 1, []
    if intent == "budget_status":
        return _budget_answer(context.get("budget", {}), year)
    if intent == "pending_expenses":
        return _pending_expenses_answer(context.get("pending_expenses", {}), year)
    if intent == "expenses_over_imm":
        return _large_expenses_answer(context.get("expenses_over_imm", {}), year)
    if intent == "bank_reconciliation":
        return _bank_answer(context.get("bank", {}))
    if intent == "rendition_status":
        return _rendition_answer(context.get("renditions", {}), year)
    if intent == "alerts":
        return _alerts_answer(context.get("alerts", {}))
    return _overview_answer(context, year)


def _budget_answer(context: dict[str, Any], year: int) -> tuple[str, float, list[AiProposedAction]]:
    if not context.get("fiscal_year_id"):
        return f"No hay datos suficientes para analizar presupuesto {year}.", 0.5, []
    answer = (
        f"Segun el presupuesto {year}, se ha ejecutado {_format_currency(context['total_executed'])} "
        f"de {_format_currency(context['total_budget'])} ({context['execution_percentage']}%). "
        f"Disponible: {_format_currency(context['total_available'])}. "
        f"Partidas en rojo: {len(context['red_items'])}; partidas en amarillo: {len(context['yellow_items'])}."
    )
    actions = []
    if context["red_items"] or context["yellow_items"]:
        actions.append(
            AiProposedAction(
                action_type="review_budget_items",
                label="Revisar partidas con ejecucion critica o preventiva",
            )
        )
    return answer, 0.92, actions


def _pending_expenses_answer(context: dict[str, Any], year: int) -> tuple[str, float, list[AiProposedAction]]:
    count = context.get("count", 0)
    if not count:
        return f"No hay gastos pendientes para el alcance consultado en {year}.", 0.9, []
    answer = (
        f"Hay {count} gastos pendientes en {year}, por un total de "
        f"{_format_currency(context.get('total_amount', 0))}. La IA no puede aprobarlos; solo prioriza su revision."
    )
    return answer, 0.9, [
        AiProposedAction(action_type="review_pending_expenses", label="Revisar gastos pendientes con mayor antiguedad")
    ]


def _large_expenses_answer(context: dict[str, Any], year: int) -> tuple[str, float, list[AiProposedAction]]:
    items = context.get("items", [])
    limit = context.get("limit_5_imm")
    if not items:
        return f"No encontre gastos sobre 5 IMM en {year} para el alcance consultado.", 0.88, []
    answer = (
        f"En {year} hay {len(items)} gastos sobre 5 IMM en la muestra consultada. "
        f"El limite usado es {_format_currency(limit)}. Estos casos requieren revision formal segun el flujo vigente."
    )
    return answer, 0.9, [
        AiProposedAction(action_type="review_large_expenses", label="Verificar respaldo y aprobacion de gastos sobre 5 IMM")
    ]


def _bank_answer(context: dict[str, Any]) -> tuple[str, float, list[AiProposedAction]]:
    total = context.get("total_transactions", 0)
    pending = context.get("pending", 0)
    if not total:
        return "No hay movimientos bancarios cargados para analizar conciliacion.", 0.75, []
    answer = (
        f"Segun los movimientos bancarios cargados, hay {total} movimientos y {pending} sin conciliar. "
        f"Avance de conciliacion: {context.get('reconciliation_percentage', 0)}%. "
        f"Saldo total en cuentas activas: {_format_currency(context.get('total_balance', 0))}."
    )
    actions = []
    if pending:
        actions.append(AiProposedAction(action_type="review_reconciliation", label="Revisar movimientos bancarios sin conciliar"))
    return answer, 0.9, actions


def _rendition_answer(context: dict[str, Any], year: int) -> tuple[str, float, list[AiProposedAction]]:
    count = context.get("count", 0)
    if not count:
        return f"No hay rendiciones cargadas para {year} en el alcance consultado.", 0.82, []
    by_status = context.get("by_status", {})
    answer = f"Hay {count} rendiciones en {year}. Distribucion por estado: {_format_status_counts(by_status)}."
    return answer, 0.88, [
        AiProposedAction(action_type="review_renditions", label="Revisar rendiciones en borrador o enviadas")
    ]


def _alerts_answer(context: dict[str, Any]) -> tuple[str, float, list[AiProposedAction]]:
    unread = context.get("unread_count", 0)
    total = context.get("count", 0)
    if not total:
        return "No hay alertas visibles para tu alcance actual.", 0.86, []
    answer = f"Hay {total} alertas visibles en tu alcance; {unread} estan no leidas."
    return answer, 0.88, [AiProposedAction(action_type="review_alerts", label="Revisar alertas no leidas")]


def _overview_answer(context: dict[str, Any], year: int) -> tuple[str, float, list[AiProposedAction]]:
    budget = context.get("budget", {})
    pending = context.get("pending_expenses", {})
    alerts = context.get("alerts", {})
    bank = context.get("bank")
    if not budget.get("fiscal_year_id"):
        return f"No hay datos suficientes para preparar un resumen ejecutivo de {year}.", 0.5, []

    parts = [
        f"Resumen {year}: ejecucion presupuestaria {budget.get('execution_percentage', 0)}%",
        f"disponible {_format_currency(budget.get('total_available', 0))}",
        f"gastos pendientes {pending.get('count', 0)}",
        f"alertas no leidas {alerts.get('unread_count', 0)}",
    ]
    if bank:
        parts.append(f"movimientos bancarios sin conciliar {bank.get('pending', 0)}")
    answer = ". ".join(parts) + "."
    actions = [
        AiProposedAction(action_type="review_operational_summary", label="Revisar focos operativos del resumen")
    ]
    return answer, 0.88, actions


def _budget_item_payload(item: BudgetItem) -> dict[str, Any]:
    allocated = float(item.allocated_amount)
    executed = float(item.executed_amount)
    return {
        "id": str(item.id),
        "number": item.number,
        "name": item.name,
        "allocated_amount": allocated,
        "executed_amount": executed,
        "available_amount": allocated - executed,
        "execution_percentage": _budget_percentage(item),
        "status_color": _budget_status(item),
        "is_blocked": item.is_blocked,
        "fund_source": item.fund_source,
    }


def _expense_payload(expense: Expense) -> dict[str, Any]:
    return {
        "id": str(expense.id),
        "description": expense.description,
        "amount": float(expense.amount),
        "status": expense.status,
        "expense_date": expense.expense_date.isoformat(),
        "supplier_name": expense.supplier_name,
        "budget_item_id": str(expense.budget_item_id),
        "company_id": str(expense.company_id) if expense.company_id else None,
    }


def _budget_percentage(item: BudgetItem) -> float:
    allocated = float(item.allocated_amount)
    executed = float(item.executed_amount)
    if allocated == 0:
        return 100 if executed > 0 else 0
    return round((executed / allocated) * 100, 1)


def _budget_status(item: BudgetItem) -> str:
    percentage = _budget_percentage(item)
    if percentage >= float(item.red_threshold):
        return "red"
    if percentage >= float(item.yellow_threshold):
        return "yellow"
    return "green"


def _format_status_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "sin estados registrados"
    return ", ".join(f"{status}: {count}" for status, count in sorted(counts.items()))


def _format_currency(value: Any) -> str:
    numeric = float(value or 0)
    return f"${numeric:,.0f}".replace(",", ".")


def _add_tool_call(tool_calls: list[AiToolCall], name: str, args: dict[str, Any], result_summary: str) -> None:
    tool_calls.append(AiToolCall(name=name, args=args, result_summary=result_summary))


def _trace(trace: list[dict[str, Any]], node: str, status_value: str, data: dict[str, Any] | None = None) -> None:
    trace.append(
        {
            "node": node,
            "status": status_value,
            "at": datetime.now(timezone.utc).isoformat(),
            "data": data or {},
        }
    )


def _create_audit_log(db: Session, run: AiRun, user: User) -> None:
    db.add(
        AuditLog(
            user_id=user.id,
            action="ai_query",
            entity_type="ai_run",
            entity_id=run.id,
            old_values=None,
            new_values={
                "status": run.status,
                "intent": run.intent,
                "tool_calls": run.tool_calls,
                "confidence": float(run.confidence) if isinstance(run.confidence, Decimal) else run.confidence,
            },
            description="Consulta IA read-only ejecutada.",
        )
    )


def _to_query_response(
    run: AiRun,
    sources: list[AiSource],
    findings: list[AiFinding],
    proposed_actions: list[AiProposedAction],
    tool_calls: list[AiToolCall],
) -> AiQueryResponse:
    return AiQueryResponse(
        run_id=run.id,
        thread_id=run.thread_id,
        status=run.status,
        intent=run.intent,
        answer=run.final_response or "",
        confidence=float(run.confidence) if run.confidence is not None else None,
        sources=sources,
        findings=findings,
        proposed_actions=proposed_actions,
        tool_calls=tool_calls,
    )


def _to_run_list_item(run: AiRun) -> AiRunListItem:
    question = None
    if isinstance(run.input_payload, dict):
        raw_question = run.input_payload.get("question")
        question = raw_question if isinstance(raw_question, str) else None
    return AiRunListItem(
        id=run.id,
        thread_id=run.thread_id,
        user_id=run.user_id,
        status=run.status,
        intent=run.intent,
        question=question,
        confidence=float(run.confidence) if run.confidence is not None else None,
        final_response=run.final_response,
        created_at=run.created_at,
        completed_at=run.completed_at,
    )


def _dump_findings(findings: list[AiFinding]) -> list[dict[str, Any]]:
    return [finding.model_dump(mode="json") for finding in findings]


def _dump_tool_calls(tool_calls: list[AiToolCall]) -> list[dict[str, Any]]:
    return [tool_call.model_dump(mode="json") for tool_call in tool_calls]


def _dump_actions(actions: list[AiProposedAction]) -> list[dict[str, Any]]:
    return [action.model_dump(mode="json") for action in actions]
