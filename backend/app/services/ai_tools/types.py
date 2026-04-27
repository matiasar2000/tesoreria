from dataclasses import dataclass
from typing import Any

from app.schemas.ai import AiFinding, AiSource, AiToolCall


@dataclass(slots=True)
class ReadOnlyToolContext:
    tool_calls: list[AiToolCall]
    sources: list[AiSource]
    findings: list[AiFinding]

    def add_tool_call(self, name: str, args: dict[str, Any], result_summary: str) -> None:
        self.tool_calls.append(AiToolCall(name=name, args=args, result_summary=result_summary))
