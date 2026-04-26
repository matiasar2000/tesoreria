from fastapi import HTTPException, status


class BusinessError(HTTPException):
    def __init__(self, detail: str, code: str, status_code: int = status.HTTP_400_BAD_REQUEST):
        super().__init__(status_code=status_code, detail={"detail": detail, "code": code})


class InsufficientBudget(BusinessError):
    def __init__(self, item_name: str, available: int, requested: int):
        super().__init__(
            detail=(
                f"Fondos insuficientes en la partida '{item_name}'. "
                f"Disponible: ${available:,.0f}, solicitado: ${requested:,.0f}"
            ).replace(",", "."),
            code="INSUFFICIENT_BUDGET",
        )


class BudgetItemBlocked(BusinessError):
    def __init__(self, item_name: str):
        super().__init__(
            detail=f"La partida '{item_name}' está bloqueada para nuevos gastos.",
            code="BUDGET_ITEM_BLOCKED",
        )


class SuperintendentLimitExceeded(BusinessError):
    def __init__(self, amount: int, limit: int):
        super().__init__(
            detail=(
                f"El gasto de ${amount:,.0f} supera el límite del Superintendente "
                f"de ${limit:,.0f} (5 IMM). Requiere aprobación del Directorio."
            ).replace(",", "."),
            code="SUPERINTENDENT_LIMIT_EXCEEDED",
            status_code=200,
        )
