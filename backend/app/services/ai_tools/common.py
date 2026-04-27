from typing import Any

from sqlalchemy.orm import Session

from app.models.fiscal_year import FiscalYear
from app.schemas.ai import AiFinding
from app.services.ai_tools.types import ReadOnlyToolContext


def get_fiscal_year(db: Session, year: int, context: ReadOnlyToolContext) -> FiscalYear | None:
    fiscal_year = db.query(FiscalYear).filter(FiscalYear.year == year).first()
    if not fiscal_year:
        context.findings.append(
            AiFinding(
                code="fiscal_year_not_found",
                severity="warning",
                message=f"No hay ano fiscal cargado para {year}.",
            )
        )
    return fiscal_year


def format_status_counts(counts: dict[str, int]) -> str:
    if not counts:
        return "sin estados registrados"
    return ", ".join(f"{status}: {count}" for status, count in sorted(counts.items()))


def format_currency(value: Any) -> str:
    numeric = float(value or 0)
    return f"${numeric:,.0f}".replace(",", ".")
