import uuid
from datetime import date, datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import HTTPException, status
from sqlalchemy.orm import Session

from app.models.ai_run import AiRun
from app.models.audit_log import AuditLog
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
from app.services.ai_graph import (
    AGENT_BEHAVIOR_VERSION,
    GRAPH_VERSION,
    READ_ONLY_TOOL_ALLOWLIST,
    ReadOnlyGraphHandlers,
    ReadOnlyGraphState,
    execute_read_only_graph,
)
from app.services.ai_observability import observe_ai_run, update_ai_observation
from app.services.ai_tools import (
    ReadOnlyToolContext,
    format_currency,
    format_status_counts,
    get_alerts_context,
    get_bank_context,
    get_budget_context,
    get_large_expenses_context,
    get_pending_expenses_context,
    get_rendition_context,
)

AI_QUERY_ROLES = {"tesorero", "equipo_tesoreria"}
AI_AUDIT_ROLES = {"tesorero"}
BANK_ROLES = AI_QUERY_ROLES


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

    handlers = ReadOnlyGraphHandlers(
        trace=_trace,
        classify_intent=_classify_intent,
        get_blocking_finding=_get_blocking_finding,
        retrieve_context=_retrieve_context,
        draft_answer=_draft_answer,
        dump_findings=_dump_findings,
        dump_tool_calls=_dump_tool_calls,
        dump_actions=_dump_actions,
    )
    initial_state = ReadOnlyGraphState(
        db=db,
        run=run,
        user=current_user,
        year=year,
        question=data.question,
        trace=trace,
        tool_calls=tool_calls,
        findings=findings,
        sources=sources,
        proposed_actions=proposed_actions,
    )

    with observe_ai_run(
        run,
        current_user,
        year=year,
        graph_version=GRAPH_VERSION,
        agent_behavior_version=AGENT_BEHAVIOR_VERSION,
    ) as observation:
        final_state = execute_read_only_graph(initial_state, handlers)
        update_ai_observation(
            observation,
            run,
            tool_count=len(final_state.get("tool_calls", [])),
            finding_count=len(final_state.get("findings", [])),
        )

    sources = final_state.get("sources", sources)
    findings = final_state.get("findings", findings)
    proposed_actions = final_state.get("proposed_actions", proposed_actions)
    tool_calls = final_state.get("tool_calls", tool_calls)
    _create_audit_log(db, run, current_user)
    db.commit()
    db.refresh(run)
    return _to_query_response(run, sources, findings, proposed_actions, tool_calls)


def get_ai_run(db: Session, run_id: uuid.UUID, current_user: User) -> AiRunResponse:
    _ensure_can_audit_ai(current_user)
    run = db.query(AiRun).filter(AiRun.id == run_id).first()
    if not run:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Corrida IA no encontrada.")
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
    _ensure_can_audit_ai(current_user)
    query = db.query(AiRun)
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
        "graph_version": GRAPH_VERSION,
        "agent_behavior_version": AGENT_BEHAVIOR_VERSION,
        "model_policy": {
            "provider": "deterministic",
            "model": "rules-engine",
            "temperature": 0,
            "fallback": "read_only_structured_response",
        },
        "execution_budget": {
            "max_graph_steps": 12,
            "max_llm_calls": 0,
            "max_tool_calls": 5,
            "max_retry_attempts": 0,
        },
        "context_budget": {
            "strategy": "minimum_sufficient_verified_context",
            "requires_internal_sources": True,
        },
        "tool_policy": {
            "mode": "read_only",
            "allowed_tools": READ_ONLY_TOOL_ALLOWLIST,
            "write_tools_allowed": False,
        },
        "guardrails": [
            "no_financial_writes",
            "role_filtered_tools",
            "source_based_answers",
            "human_review_required_for_sensitive_actions",
            "tool_policy_gate",
            "agent_behavior_versioning",
        ],
    }


def can_query_ai(user: User) -> bool:
    return user.role in AI_QUERY_ROLES


def can_audit_ai(user: User) -> bool:
    return user.role in AI_AUDIT_ROLES


def _ensure_can_audit_ai(user: User) -> None:
    if not can_audit_ai(user):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene permisos para auditar corridas IA.")


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
    tool_context = ReadOnlyToolContext(tool_calls=tool_calls, sources=sources, findings=findings)
    if intent == "budget_status":
        return {"budget": get_budget_context(db, year, tool_context)}
    if intent == "pending_expenses":
        return {"pending_expenses": get_pending_expenses_context(db, year, user, tool_context)}
    if intent == "expenses_over_imm":
        return {"expenses_over_imm": get_large_expenses_context(db, year, user, tool_context)}
    if intent == "bank_reconciliation":
        return {"bank": get_bank_context(db, tool_context)}
    if intent == "rendition_status":
        return {"renditions": get_rendition_context(db, year, user, tool_context)}
    if intent == "alerts":
        return {"alerts": get_alerts_context(db, user, tool_context)}

    context: dict[str, Any] = {
        "budget": get_budget_context(db, year, tool_context),
        "pending_expenses": get_pending_expenses_context(db, year, user, tool_context),
        "alerts": get_alerts_context(db, user, tool_context),
        "renditions": get_rendition_context(db, year, user, tool_context),
    }
    if user.role in BANK_ROLES:
        context["bank"] = get_bank_context(db, tool_context)
    return context


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
        f"Segun el presupuesto {year}, se ha ejecutado {format_currency(context['total_executed'])} "
        f"de {format_currency(context['total_budget'])} ({context['execution_percentage']}%). "
        f"Disponible: {format_currency(context['total_available'])}. "
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
        f"{format_currency(context.get('total_amount', 0))}. La IA no puede aprobarlos; solo prioriza su revision."
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
        f"El limite usado es {format_currency(limit)}. Estos casos requieren revision formal segun el flujo vigente."
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
        f"Saldo total en cuentas activas: {format_currency(context.get('total_balance', 0))}."
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
    answer = f"Hay {count} rendiciones en {year}. Distribucion por estado: {format_status_counts(by_status)}."
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
        f"disponible {format_currency(budget.get('total_available', 0))}",
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
