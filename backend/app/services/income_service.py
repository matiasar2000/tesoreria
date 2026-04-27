import uuid

from fastapi import HTTPException, status
from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.models.income import Income
from app.schemas.income import IncomeCreate, IncomeResponse


SOURCE_TYPE_LABELS = {
    "subvencion_fiscal": "Subvención Fiscal",
    "subvencion_municipal": "Subvención Municipal",
    "donacion": "Donación",
    "cuota_voluntarios": "Cuota Voluntarios",
    "rifa": "Rifa/Beneficio",
    "beneficio": "Beneficio",
    "aporte_compania": "Aporte Compañía",
    "otro": "Otro",
}

MONTH_NAMES = {
    1: "Enero",
    2: "Febrero",
    3: "Marzo",
    4: "Abril",
    5: "Mayo",
    6: "Junio",
    7: "Julio",
    8: "Agosto",
    9: "Septiembre",
    10: "Octubre",
    11: "Noviembre",
    12: "Diciembre",
}


def _validate_source_type(source_type: str) -> None:
    if source_type not in SOURCE_TYPE_LABELS:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de fuente de ingreso inválido.")


def _to_response(income: Income) -> IncomeResponse:
    data = {c.name: getattr(income, c.name) for c in income.__table__.columns}
    data["source_type_label"] = SOURCE_TYPE_LABELS.get(income.source_type, income.source_type)
    data["company_name"] = income.company.name if income.company else None
    data["created_by_name"] = income.created_by.full_name if income.created_by else None
    return IncomeResponse(**data)


def create_income(db: Session, data: IncomeCreate, user_id: uuid.UUID) -> IncomeResponse:
    _validate_source_type(data.source_type)

    income = Income(
        fiscal_year_id=data.fiscal_year_id,
        source_type=data.source_type,
        source_detail=data.source_detail,
        amount=data.amount,
        income_date=data.income_date,
        reference=data.reference,
        company_id=data.company_id,
        notes=data.notes,
        created_by_id=user_id,
    )
    db.add(income)
    db.commit()
    db.refresh(income)
    return _to_response(income)


def get_incomes(
    db: Session,
    fiscal_year_id: uuid.UUID | None = None,
    source_type: str | None = None,
) -> list[IncomeResponse]:
    query = db.query(Income)
    if fiscal_year_id:
        query = query.filter(Income.fiscal_year_id == fiscal_year_id)
    if source_type:
        _validate_source_type(source_type)
        query = query.filter(Income.source_type == source_type)

    incomes = query.order_by(Income.income_date.desc(), Income.created_at.desc()).all()
    return [_to_response(income) for income in incomes]


def get_income_summary(db: Session, fiscal_year_id: uuid.UUID) -> dict:
    total_income = (
        db.query(func.coalesce(func.sum(Income.amount), 0))
        .filter(Income.fiscal_year_id == fiscal_year_id)
        .scalar()
    )

    by_source_rows = (
        db.query(
            Income.source_type,
            func.coalesce(func.sum(Income.amount), 0).label("total"),
            func.count(Income.id).label("count"),
        )
        .filter(Income.fiscal_year_id == fiscal_year_id)
        .group_by(Income.source_type)
        .order_by(func.sum(Income.amount).desc())
        .all()
    )

    month_expr = extract("month", Income.income_date)
    by_month_rows = (
        db.query(
            month_expr.label("month"),
            func.coalesce(func.sum(Income.amount), 0).label("total"),
        )
        .filter(Income.fiscal_year_id == fiscal_year_id)
        .group_by(month_expr)
        .order_by(month_expr)
        .all()
    )

    return {
        "total_income": float(total_income or 0),
        "by_source": [
            {
                "source_type": row.source_type,
                "label": SOURCE_TYPE_LABELS.get(row.source_type, row.source_type),
                "total": float(row.total or 0),
                "count": row.count,
            }
            for row in by_source_rows
        ],
        "by_month": [
            {
                "month": int(row.month),
                "month_name": MONTH_NAMES.get(int(row.month), str(int(row.month))),
                "total": float(row.total or 0),
            }
            for row in by_month_rows
        ],
    }


def delete_income(db: Session, income_id: uuid.UUID) -> None:
    income = db.query(Income).filter(Income.id == income_id).first()
    if not income:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Ingreso no encontrado.")

    db.delete(income)
    db.commit()
