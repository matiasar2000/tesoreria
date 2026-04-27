import uuid
from types import SimpleNamespace

from app.models.ai_run import AiRun
from app.models.audit_log import AuditLog
from app.schemas.ai import AiQueryRequest
from app.services import ai_service


class FakeSession:
    def __init__(self) -> None:
        self.added: list[object] = []
        self.commit_called = False

    def add(self, item: object) -> None:
        self.added.append(item)

    def flush(self) -> None:
        for item in self.added:
            if hasattr(item, "id") and getattr(item, "id") is None:
                setattr(item, "id", uuid.uuid4())

    def commit(self) -> None:
        self.commit_called = True

    def refresh(self, item: object) -> None:
        return None


def test_classify_intent_maps_read_only_workflows() -> None:
    assert ai_service._classify_intent("Que partidas estan en rojo?") == "budget_status"
    assert ai_service._classify_intent("Movimientos bancarios sin conciliar") == "bank_reconciliation"
    assert ai_service._classify_intent("Gastos mayores a 5 IMM") == "expenses_over_imm"
    assert ai_service._classify_intent("Rendiciones pendientes") == "rendition_status"
    assert ai_service._classify_intent("Alertas criticas") == "alerts"


def test_policy_context_is_read_only() -> None:
    policy = ai_service._build_policy_context()

    assert policy["mode"] == "read_only"
    assert policy["writes_allowed"] is False
    assert "no_financial_writes" in policy["guardrails"]


def test_user_context_exposes_bank_scope_only_to_treasury_roles() -> None:
    director = SimpleNamespace(id=uuid.uuid4(), role="director_compania", company_id=uuid.uuid4())
    tesorero = SimpleNamespace(id=uuid.uuid4(), role="tesorero", company_id=None)

    assert "bank:read" not in ai_service._build_user_context(director)["scopes"]
    assert "bank:read" in ai_service._build_user_context(tesorero)["scopes"]


def test_bank_query_is_blocked_for_director_and_audited_without_financial_writes() -> None:
    db = FakeSession()
    user = SimpleNamespace(id=uuid.uuid4(), role="director_compania", company_id=uuid.uuid4())

    response = ai_service.run_read_only_query(
        db,
        AiQueryRequest(question="Que movimientos bancarios no estan conciliados?", year=2026),
        user,
    )

    assert response.status == "bloqueado"
    assert response.intent == "bank_reconciliation"
    assert response.tool_calls == []
    assert response.findings[0].code == "bank_scope_denied"
    assert db.commit_called is True
    assert {type(item).__name__ for item in db.added} == {"AiRun", "AuditLog"}

    ai_run = next(item for item in db.added if isinstance(item, AiRun))
    audit_log = next(item for item in db.added if isinstance(item, AuditLog))
    assert ai_run.policy_context["writes_allowed"] is False
    assert ai_run.status == "bloqueado"
    assert audit_log.action == "ai_query"
    assert audit_log.entity_type == "ai_run"
    assert audit_log.entity_id == ai_run.id
