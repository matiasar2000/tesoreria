RESTRICTED_SOURCES = {"fiscal", "municipal"}

SOURCE_LABELS = {
    "fiscal": "Subvención Fiscal",
    "municipal": "Subvención Municipal",
    "propio": "Fondos Propios",
    "donacion": "Donación",
    "general": "General",
}


def validate_fund_usage(budget_item, expense_data):
    warnings = []
    if budget_item.fund_source in RESTRICTED_SOURCES:
        if not expense_data.notes:
            warnings.append(
                f"Gasto con fondos {SOURCE_LABELS[budget_item.fund_source]}: "
                "se recomienda documentar la justificación en notas."
            )
    return warnings
