from dataclasses import dataclass
from datetime import datetime, timezone
from typing import Any, Callable, TypedDict, cast

from sqlalchemy.orm import Session

from app.models.ai_run import AiRun
from app.models.user import User
from app.schemas.ai import AiFinding, AiProposedAction, AiSource, AiToolCall

GRAPH_VERSION = "ia-read-only-v1"
AGENT_BEHAVIOR_VERSION = "ia-read-only-v1.0.0"
READ_ONLY_TOOL_ALLOWLIST = [
    "get_budget_summary",
    "search_expenses",
    "get_bank_transactions",
    "get_rendition_status",
    "get_alerts",
]


class ReadOnlyGraphState(TypedDict, total=False):
    db: Session
    run: AiRun
    user: User
    year: int
    question: str
    trace: list[dict[str, Any]]
    tool_calls: list[AiToolCall]
    findings: list[AiFinding]
    sources: list[AiSource]
    proposed_actions: list[AiProposedAction]
    intent: str
    domain_context: dict[str, Any]
    answer: str
    confidence: float
    blocked: bool
    graph_runtime: str


@dataclass(slots=True)
class ReadOnlyGraphHandlers:
    trace: Callable[[list[dict[str, Any]], str, str, dict[str, Any] | None], None]
    classify_intent: Callable[[str], str]
    get_blocking_finding: Callable[[str, User], AiFinding | None]
    retrieve_context: Callable[
        [Session, str, int, User, list[AiToolCall], list[AiSource], list[AiFinding]],
        dict[str, Any],
    ]
    draft_answer: Callable[
        [str, dict[str, Any], int, list[AiFinding]],
        tuple[str, float, list[AiProposedAction]],
    ]
    dump_findings: Callable[[list[AiFinding]], list[dict[str, Any]]]
    dump_tool_calls: Callable[[list[AiToolCall]], list[dict[str, Any]]]
    dump_actions: Callable[[list[AiProposedAction]], list[dict[str, Any]]]


class _LangGraphUnavailable(Exception):
    pass


def execute_read_only_graph(
    initial_state: ReadOnlyGraphState,
    handlers: ReadOnlyGraphHandlers,
) -> ReadOnlyGraphState:
    try:
        final_state = _execute_langgraph(initial_state, handlers)
        _set_graph_runtime(final_state, "langgraph")
        return final_state
    except _LangGraphUnavailable:
        final_state = _execute_sequential(initial_state, handlers)
        _set_graph_runtime(final_state, "sequential")
        return final_state
    except Exception as exc:
        trace = initial_state["trace"]
        handlers.trace(
            trace,
            "fallback_or_degrade",
            "completed",
            {"reason": "langgraph_runtime_error", "error": str(exc)},
        )
        initial_state["trace"] = trace
        final_state = _execute_sequential(initial_state, handlers)
        _set_graph_runtime(final_state, "sequential_fallback")
        return final_state


def _execute_langgraph(
    initial_state: ReadOnlyGraphState,
    handlers: ReadOnlyGraphHandlers,
) -> ReadOnlyGraphState:
    try:
        from langgraph.graph import END, START, StateGraph
    except ImportError as exc:
        raise _LangGraphUnavailable from exc

    nodes = _build_nodes(handlers)
    builder = StateGraph(ReadOnlyGraphState)
    builder.add_node("receive_request", nodes["receive_request"])
    builder.add_node("initialize_harness", nodes["initialize_harness"])
    builder.add_node("classify_intent", nodes["classify_intent"])
    builder.add_node("authorize_scope", nodes["authorize_scope"])
    builder.add_node("retrieve_context", nodes["retrieve_context"])
    builder.add_node("draft_answer", nodes["draft_answer"])
    builder.add_node("finalize_response", nodes["finalize_response"])
    builder.add_node("log_audit", nodes["log_audit"])

    builder.add_edge(START, "receive_request")
    builder.add_edge("receive_request", "initialize_harness")
    builder.add_edge("initialize_harness", "classify_intent")
    builder.add_edge("classify_intent", "authorize_scope")
    builder.add_conditional_edges(
        "authorize_scope",
        _route_after_authorize,
        {"blocked": "finalize_response", "allowed": "retrieve_context"},
    )
    builder.add_edge("retrieve_context", "draft_answer")
    builder.add_edge("draft_answer", "finalize_response")
    builder.add_edge("finalize_response", "log_audit")
    builder.add_edge("log_audit", END)

    graph = builder.compile()
    result = graph.invoke(initial_state, config={"configurable": {"thread_id": str(initial_state["run"].thread_id)}})
    return cast(ReadOnlyGraphState, result)


def _execute_sequential(
    initial_state: ReadOnlyGraphState,
    handlers: ReadOnlyGraphHandlers,
) -> ReadOnlyGraphState:
    nodes = _build_nodes(handlers)
    state = dict(initial_state)

    for node_name in ("receive_request", "initialize_harness", "classify_intent", "authorize_scope"):
        state.update(nodes[node_name](cast(ReadOnlyGraphState, state)))

    if _route_after_authorize(cast(ReadOnlyGraphState, state)) == "allowed":
        for node_name in ("retrieve_context", "draft_answer"):
            state.update(nodes[node_name](cast(ReadOnlyGraphState, state)))

    for node_name in ("finalize_response", "log_audit"):
        state.update(nodes[node_name](cast(ReadOnlyGraphState, state)))

    return cast(ReadOnlyGraphState, state)


def _build_nodes(
    handlers: ReadOnlyGraphHandlers,
) -> dict[str, Callable[[ReadOnlyGraphState], ReadOnlyGraphState]]:
    def receive_request(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        run.status = "iniciado"
        handlers.trace(trace, "receive_request", "completed", {"year": state["year"]})
        return {"run": run, "trace": trace}

    def initialize_harness(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        policy_context = dict(run.policy_context or {})
        policy_context.update(
            {
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
            }
        )
        run.status = "configurando_harness"
        run.policy_context = policy_context
        handlers.trace(
            trace,
            "initialize_harness",
            "completed",
            {
                "graph_version": GRAPH_VERSION,
                "agent_behavior_version": AGENT_BEHAVIOR_VERSION,
            },
        )
        return {"run": run, "trace": trace}

    def classify_intent(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        intent = handlers.classify_intent(state["question"])
        run.intent = intent
        handlers.trace(trace, "classify_intent", "completed", {"intent": intent})
        return {"intent": intent, "run": run, "trace": trace}

    def authorize_scope(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        findings = state["findings"]
        run.status = "autorizando"
        blocking_finding = handlers.get_blocking_finding(state["intent"], state["user"])
        if blocking_finding:
            findings.append(blocking_finding)
            run.status = "bloqueado"
            handlers.trace(
                trace,
                "authorize_scope",
                "blocked",
                {"code": blocking_finding.code},
            )
            return {
                "run": run,
                "trace": trace,
                "findings": findings,
                "blocked": True,
                "answer": blocking_finding.message,
                "confidence": 1,
            }

        handlers.trace(trace, "authorize_scope", "completed", {"intent": state["intent"]})
        return {"run": run, "trace": trace, "blocked": False}

    def retrieve_context(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        run.status = "contextualizando"
        domain_context = handlers.retrieve_context(
            state["db"],
            state["intent"],
            state["year"],
            state["user"],
            state["tool_calls"],
            state["sources"],
            state["findings"],
        )
        handlers.trace(
            trace,
            "retrieve_context",
            "completed",
            {"tools": [tool_call.name for tool_call in state["tool_calls"]]},
        )
        return {"run": run, "trace": trace, "domain_context": domain_context}

    def draft_answer(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        run.status = "analizando"
        answer, confidence, proposed_actions = handlers.draft_answer(
            state["intent"],
            state.get("domain_context", {}),
            state["year"],
            state["findings"],
        )
        handlers.trace(trace, "draft_answer", "completed", {"confidence": confidence})
        return {
            "run": run,
            "trace": trace,
            "answer": answer,
            "confidence": confidence,
            "proposed_actions": proposed_actions,
        }

    def finalize_response(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        run.status = "bloqueado" if state.get("blocked") else "finalizado"
        run.domain_context = state.get("domain_context", {})
        run.tool_calls = handlers.dump_tool_calls(state["tool_calls"])
        run.findings = handlers.dump_findings(state["findings"])
        run.confidence = state.get("confidence")
        run.proposed_actions = handlers.dump_actions(state.get("proposed_actions", []))
        run.final_response = state.get("answer", "")
        run.completed_at = datetime.now(timezone.utc)
        handlers.trace(trace, "finalize_response", "completed", {"status": run.status})
        run.audit_trace = trace
        return {"run": run, "trace": trace}

    def log_audit(state: ReadOnlyGraphState) -> ReadOnlyGraphState:
        run = state["run"]
        trace = state["trace"]
        handlers.trace(trace, "log_audit", "completed", {"audit_target": "audit_log"})
        run.audit_trace = trace
        return {"run": run, "trace": trace}

    return {
        "receive_request": receive_request,
        "initialize_harness": initialize_harness,
        "classify_intent": classify_intent,
        "authorize_scope": authorize_scope,
        "retrieve_context": retrieve_context,
        "draft_answer": draft_answer,
        "finalize_response": finalize_response,
        "log_audit": log_audit,
    }


def _route_after_authorize(state: ReadOnlyGraphState) -> str:
    return "blocked" if state.get("blocked") else "allowed"


def _set_graph_runtime(state: ReadOnlyGraphState, runtime: str) -> None:
    state["graph_runtime"] = runtime
    run = state["run"]
    policy_context = dict(run.policy_context or {})
    policy_context["graph_runtime"] = runtime
    run.policy_context = policy_context
