import os
from contextlib import contextmanager
from dataclasses import dataclass
from decimal import Decimal
from typing import Any, Iterator, Protocol

from app.config import settings
from app.models.ai_run import AiRun
from app.models.user import User


class AiObservation(Protocol):
    def update(self, **kwargs: Any) -> None:
        pass


@dataclass(slots=True)
class NoopObservation:
    def update(self, **kwargs: Any) -> None:
        return None


def langfuse_configured() -> bool:
    return bool(
        settings.LANGFUSE_ENABLED
        and settings.LANGFUSE_PUBLIC_KEY
        and settings.LANGFUSE_SECRET_KEY
        and settings.LANGFUSE_BASE_URL
    )


@contextmanager
def observe_ai_run(
    run: AiRun,
    user: User,
    *,
    year: int,
    graph_version: str,
    agent_behavior_version: str,
) -> Iterator[AiObservation]:
    if not langfuse_configured():
        yield NoopObservation()
        return

    try:
        _configure_langfuse_environment()
        from langfuse import get_client

        client = get_client()
        trace_id = client.create_trace_id(seed=str(run.id))
        metadata = {
            "erp_run_id": str(run.id),
            "thread_id": str(run.thread_id),
            "user_role": user.role,
            "company_id": str(user.company_id) if user.company_id else None,
            "environment": settings.ENVIRONMENT,
            "graph_version": graph_version,
            "agent_behavior_version": agent_behavior_version,
        }

        with client.start_as_current_observation(
            as_type="span",
            name="tesoreria.ai.read_only_query",
            input={"year": year},
            trace_context={"trace_id": trace_id},
        ) as observation:
            if hasattr(client, "update_current_trace"):
                client.update_current_trace(
                    user_id=str(user.id),
                    session_id=str(run.thread_id),
                    tags=["tesoreria", "ia", "read_only", settings.ENVIRONMENT],
                    metadata=metadata,
                )
            observation.update(metadata=metadata)
            yield observation
    except Exception:
        yield NoopObservation()


def update_ai_observation(
    observation: AiObservation,
    run: AiRun,
    *,
    tool_count: int,
    finding_count: int,
) -> None:
    try:
        observation.update(
            output={
                "status": run.status,
                "intent": run.intent,
                "confidence": _json_confidence(run.confidence),
            },
            metadata={
                "tool_count": tool_count,
                "finding_count": finding_count,
            },
        )
    except Exception:
        return None


def _configure_langfuse_environment() -> None:
    os.environ["LANGFUSE_PUBLIC_KEY"] = settings.LANGFUSE_PUBLIC_KEY or ""
    os.environ["LANGFUSE_SECRET_KEY"] = settings.LANGFUSE_SECRET_KEY or ""
    os.environ["LANGFUSE_BASE_URL"] = settings.LANGFUSE_BASE_URL or ""


def _json_confidence(confidence: Any) -> float | None:
    if confidence is None:
        return None
    if isinstance(confidence, Decimal):
        return float(confidence)
    if isinstance(confidence, int | float):
        return float(confidence)
    return None
