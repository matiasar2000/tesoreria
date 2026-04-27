"""
Carga datos demo para modulos operativos.
Ejecutar: python -m seeds.seed_demo_modules
"""

import os
import sys
from datetime import date, datetime, timezone
from decimal import Decimal

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import func

from app.core.security import hash_password
from app.database import SessionLocal
from app.models.approval_step import ApprovalStep
from app.models.asset import Asset
from app.models.bank_account import BankAccount
from app.models.bank_transaction import BankTransaction
from app.models.budget_item import BudgetItem
from app.models.company import Company
from app.models.expense import Expense
from app.models.fiscal_year import FiscalYear
from app.models.income import Income
from app.models.rendition import Rendition, RenditionItem
from app.models.user import User


DEMO_MARKER = "seed_demo_modules:v1"
FISCAL_YEAR = 2026

DEMO_USERS = [
    {
        "email": "equipo.tesoreria@cbt.cl",
        "password": "equipo2026",
        "full_name": "Equipo Tesoreria CBT",
        "role": "equipo_tesoreria",
        "area": "Tesoreria",
    },
    {
        "email": "directorio@cbt.cl",
        "password": "directorio2026",
        "full_name": "Directorio General CBT",
        "role": "directorio",
        "area": "Directorio",
    },
    {
        "email": "superintendente@cbt.cl",
        "password": "super2026",
        "full_name": "Superintendente CBT",
        "role": "superintendente",
        "area": "Superintendencia",
    },
]

DEMO_ACCOUNTS = [
    ("BancoEstado", "00-000-00000-00", "corriente", "Cuenta Corriente CBT"),
    ("Banco Santander", "00-000-00001-00", "corriente", "Cuenta Operacional"),
    ("BancoEstado", "00-000-00002-00", "ahorro", "Cuenta Ahorro Reserva"),
]

DEMO_INCOMES = [
    ("subvencion_municipal", "Municipalidad de Talcahuano", 240_000_000, date(2026, 1, 15), "ING-DEM-001", None, "Primera remesa municipal 2026"),
    ("subvencion_fiscal", "Junta Nacional de Bomberos", 120_000_000, date(2026, 1, 28), "ING-DEM-002", None, "Subvencion fiscal operacional"),
    ("cuota_voluntarios", "Cuotas enero-marzo", 3_250_000, date(2026, 3, 31), "ING-DEM-003", None, "Recaudacion trimestral"),
    ("donacion", "Empresa Portuaria Talcahuano", 2_500_000, date(2026, 2, 12), "ING-DEM-004", None, "Donacion para material menor"),
    ("beneficio", "Cena solidaria CBT", 1_850_000, date(2026, 4, 6), "ING-DEM-005", None, "Beneficio institucional"),
    ("aporte_compania", "Aporte operativo Primera Compania", 650_000, date(2026, 4, 10), "ING-DEM-006", 1, "Aporte de compania"),
    ("aporte_compania", "Aporte operativo Sexta Compania", 420_000, date(2026, 4, 18), "ING-DEM-007", 6, "Aporte de compania"),
    ("rifa", "Rifa aniversario", 980_000, date(2026, 5, 8), "ING-DEM-008", None, "Recaudacion actividad comunitaria"),
]

DEMO_ASSETS = [
    ("Carro bomba B-1", "vehiculo", "Unidad operativa asignada a Primera Compania", "CBT-B1-2019", 1, date(2019, 8, 14), 185_000_000, "bueno", "Cuartel Primera Compania"),
    ("Camion aljibe Z-2", "vehiculo", "Apoyo abastecimiento de agua", "CBT-Z2-2016", 2, date(2016, 4, 20), 96_000_000, "regular", "Cuartel Segunda Compania"),
    ("Equipo hidraulico rescate", "herramienta", "Set de corte y expansion", "HOL-RES-042", 3, date(2022, 9, 5), 18_500_000, "bueno", "Bodega rescate"),
    ("Motobomba portatil", "equipamiento", "Motobomba para incendios forestales", "WTR-2023-118", 4, date(2023, 12, 18), 4_200_000, "bueno", "Bodega comandancia"),
    ("Radios portatiles VHF", "equipamiento", "Lote de 12 radios operativas", "RAD-VHF-012", None, date(2024, 6, 3), 7_800_000, "bueno", "Central de comunicaciones"),
    ("Uniformes estructurales lote 2025", "uniforme", "Conjunto de 20 uniformes estructurales", "UNI-EST-2025", 5, date(2025, 3, 12), 24_000_000, "bueno", "Bodega vestuario"),
    ("Compresor cascada aire", "equipamiento", "Carga de equipos ERA", "AIR-CAS-2018", None, date(2018, 7, 27), 12_400_000, "regular", "Sala ERA"),
    ("Mangueras forestales 45mm", "material_operativo", "Lote de mangueras para temporada forestal", "MNG-FOR-045", 6, date(2026, 2, 22), 1_780_000, "bueno", "Bodega Sexta Compania"),
    ("Generador electrico 8kVA", "herramienta", "Respaldo energia emergencias", "GEN-8KVA-017", 7, date(2021, 5, 30), 1_250_000, "regular", "Cuartel Septima Compania"),
    ("Notebook tesoreria", "mobiliario", "Equipo administrativo para rendiciones", "NTB-TES-004", None, date(2025, 11, 4), 850_000, "bueno", "Oficina Tesoreria"),
    ("Archivador ignifugo", "mobiliario", "Custodia documental contable", "ARC-IGN-002", None, date(2024, 2, 15), 620_000, "bueno", "Oficina Tesoreria"),
    ("Cuartel central", "inmueble", "Dependencias administrativas y operativas", "INM-CEN-001", None, date(1998, 1, 1), 420_000_000, "bueno", "Talcahuano centro"),
    ("Escalas telescopicas", "material_operativo", "Dos escalas para rescate en altura", "ESC-TEL-009", 8, date(2020, 10, 9), 2_100_000, "regular", "Bodega Octava Compania"),
    ("Equipo ERA antiguo", "equipamiento", "Equipo dado de baja por vida util", "ERA-OLD-014", 9, date(2012, 3, 7), 3_600_000, "baja", "Bodega baja"),
    ("Kit primeros auxilios avanzado", "material_operativo", "Reposicion modulo sanitario", "KIT-PA-2026", 6, date(2026, 4, 11), 480_000, "bueno", "Sexta Compania"),
]

DEMO_ASSET_EXPENSE_LINKS = {
    "MNG-FOR-045": "Adquisicion mangueras forestales",
    "KIT-PA-2026": "Compra material primeros auxilios",
    "RAD-VHF-012": "Proyecto radio comunicaciones repetidor",
    "UNI-EST-2025": "Solicitud uniformes guardia rentada",
}

DEMO_EXPENSES = [
    (6, 1, 850_000, "Compra de combustible enero - unidad B-1", "76.111.111-1", "Copec Talcahuano", "F-10451", date(2026, 1, 18), "approved", False, True, "Consumo operativo enero"),
    (36, 2, 1_250_000, "Mantencion preventiva carro bomba B-2", "77.222.222-2", "Talleres Bio Bio SpA", "F-20987", date(2026, 1, 26), "approved", False, True, "Mantencion preventiva programada"),
    (34, 3, 1_780_000, "Adquisicion mangueras forestales", "78.333.333-3", "Implementos FireSafe", "F-30211", date(2026, 2, 20), "approved", False, True, "Reposicion temporada forestal"),
    (18, 1, 245_000, "Servicio internet cuartel central marzo", "79.444.444-4", "Telecom Sur", "F-44019", date(2026, 3, 5), "approved", False, False, "Servicio mensual comunicaciones"),
    (38, 4, 920_000, "Capacitacion primeros respondedores", "80.555.555-5", "OTEC Rescate Integral", "F-50123", date(2026, 3, 22), "approved", False, False, "Curso certificado para voluntarios"),
    (35, 5, 2_350_000, "Reparacion menor sala maquinas", "81.666.666-6", "Constructora Lenga Ltda", "F-60145", date(2026, 4, 9), "approved", False, True, "Reparacion de radier y porton"),
    (8, 6, 480_000, "Compra material primeros auxilios", "82.777.777-7", "Salud Emergencias Ltda", "F-70118", date(2026, 4, 13), "approved", False, True, "Reposicion botiquines avanzados"),
    (13, 7, 315_000, "Alimentos guardia nocturna marzo", "83.888.888-8", "Distribuidora El Faro", "F-80222", date(2026, 4, 16), "approved", False, False, "Alimentos guardia nocturna"),
    (15, 8, 1_680_000, "Solicitud uniformes guardia rentada", "84.999.999-9", "Uniformes del Sur", "COT-119", date(2026, 4, 21), "pending_review", False, False, "Pendiente revision documental"),
    (2, None, 2_250_000, "Honorarios asesor contable abril", "15.222.333-4", "Consultora Gestion Publica", "BH-778", date(2026, 4, 22), "pending_approval", False, False, "Revision tecnica aprobada"),
    (32, None, 5_200_000, "Proyecto radio comunicaciones repetidor", "85.111.222-3", "Radiocom Ltda", "COT-332", date(2026, 4, 24), "pending_directorio", True, False, "Supera 5 IMM y requiere directorio"),
    (28, 3, 760_000, "Premios ceremonia aniversario", "86.444.555-6", "Trofeos Pacifico", "F-90017", date(2026, 4, 25), "rejected", False, False, "Rechazado por falta de respaldo"),
    (24, 1, 190_000, "Caja chica reposicion abril", "87.777.888-9", "Varios proveedores", "CC-041", date(2026, 4, 26), "voided", False, False, "Anulado por duplicidad"),
]

DEMO_TRANSACTIONS = [
    ("Cuenta Corriente CBT", "DEMO-SALDO-CC", date(2026, 1, 1), 150_000_000, "credit", "Saldo inicial cuenta corriente", None),
    ("Cuenta Operacional", "DEMO-SALDO-OP", date(2026, 1, 1), 30_000_000, "credit", "Saldo inicial cuenta operacional", None),
    ("Cuenta Ahorro Reserva", "DEMO-SALDO-AH", date(2026, 1, 1), 75_000_000, "credit", "Saldo inicial ahorro reserva", None),
    ("Cuenta Corriente CBT", "ING-DEM-001", date(2026, 1, 15), 240_000_000, "credit", "Subvencion municipal 2026", None),
    ("Cuenta Corriente CBT", "ING-DEM-002", date(2026, 1, 28), 120_000_000, "credit", "Subvencion fiscal operacional", None),
    ("Cuenta Operacional", "ING-DEM-004", date(2026, 2, 12), 2_500_000, "credit", "Donacion Empresa Portuaria Talcahuano", None),
    ("Cuenta Operacional", "ING-DEM-005", date(2026, 4, 6), 1_850_000, "credit", "Beneficio cena solidaria CBT", None),
    ("Cuenta Ahorro Reserva", "INT-DEM-001", date(2026, 4, 30), 450_000, "credit", "Intereses cuenta ahorro reserva", None),
    ("Cuenta Corriente CBT", "PAG-DEM-001", date(2026, 1, 19), 850_000, "debit", "Pago combustible enero B-1", "Compra de combustible enero - unidad B-1"),
    ("Cuenta Corriente CBT", "PAG-DEM-002", date(2026, 1, 29), 1_250_000, "debit", "Pago mantencion carro bomba B-2", "Mantencion preventiva carro bomba B-2"),
    ("Cuenta Operacional", "PAG-DEM-003", date(2026, 2, 23), 1_780_000, "debit", "Pago mangueras forestales", "Adquisicion mangueras forestales"),
    ("Cuenta Corriente CBT", "PAG-DEM-004", date(2026, 3, 6), 245_000, "debit", "Pago servicio internet marzo", "Servicio internet cuartel central marzo"),
    ("Cuenta Operacional", "PAG-DEM-005", date(2026, 3, 25), 920_000, "debit", "Pago capacitacion primeros respondedores", "Capacitacion primeros respondedores"),
    ("Cuenta Operacional", "PAG-DEM-006", date(2026, 4, 10), 2_350_000, "debit", "Pago reparacion sala maquinas", "Reparacion menor sala maquinas"),
    ("Cuenta Corriente CBT", "PAG-DEM-007", date(2026, 4, 15), 480_000, "debit", "Pago material primeros auxilios", "Compra material primeros auxilios"),
    ("Cuenta Corriente CBT", "PAG-DEM-008", date(2026, 4, 17), 315_000, "debit", "Pago alimentos guardia nocturna", "Alimentos guardia nocturna marzo"),
]

DEMO_RENDITIONS = [
    (1, date(2026, 1, 1), date(2026, 1, 31), "approved", "Rendicion enero Primera Compania"),
    (2, date(2026, 1, 1), date(2026, 1, 31), "submitted", "Rendicion enero Segunda Compania"),
    (3, date(2026, 2, 1), date(2026, 2, 28), "draft", "Rendicion febrero Tercera Compania"),
    (5, date(2026, 4, 1), date(2026, 4, 30), "submitted", "Rendicion abril Quinta Compania"),
    (6, date(2026, 4, 1), date(2026, 4, 30), "approved", "Rendicion abril Sexta Compania"),
]


def _money(value: int | float | Decimal) -> Decimal:
    return Decimal(str(value))


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _ensure_users(db) -> dict[str, User]:
    created = 0
    for data in DEMO_USERS:
        user = db.query(User).filter(User.email == data["email"]).first()
        if user:
            continue
        db.add(
            User(
                email=data["email"],
                hashed_password=hash_password(data["password"]),
                full_name=data["full_name"],
                role=data["role"],
                area=data["area"],
            )
        )
        created += 1
    db.flush()
    print(f"  Usuarios demo creados: {created}")
    return {user.email: user for user in db.query(User).all()}


def _ensure_accounts(db) -> dict[str, BankAccount]:
    created = 0
    for bank_name, account_number, account_type, alias in DEMO_ACCOUNTS:
        account = db.query(BankAccount).filter(BankAccount.alias == alias).first()
        if account:
            continue
        db.add(
            BankAccount(
                bank_name=bank_name,
                account_number=account_number,
                account_type=account_type,
                alias=alias,
                balance=0,
            )
        )
        created += 1
    db.flush()
    print(f"  Cuentas bancarias demo creadas: {created}")
    return {account.alias: account for account in db.query(BankAccount).all()}


def _get_base_data(db) -> tuple[FiscalYear, dict[int, Company], dict[int, BudgetItem]]:
    fiscal_year = db.query(FiscalYear).filter(FiscalYear.year == FISCAL_YEAR).first()
    if not fiscal_year:
        raise RuntimeError(f"No existe el ano fiscal {FISCAL_YEAR}. Ejecuta primero seeds.run_seeds.")

    companies = {company.number: company for company in db.query(Company).all()}
    budget_items = {
        item.number: item
        for item in db.query(BudgetItem).filter(BudgetItem.fiscal_year_id == fiscal_year.id).all()
    }
    return fiscal_year, companies, budget_items


def _ensure_incomes(db, fiscal_year: FiscalYear, companies: dict[int, Company], creator: User) -> None:
    created = 0
    for source_type, detail, amount, income_date, reference, company_number, notes in DEMO_INCOMES:
        income = db.query(Income).filter(Income.reference == reference).first()
        if income:
            continue
        db.add(
            Income(
                fiscal_year_id=fiscal_year.id,
                source_type=source_type,
                source_detail=detail,
                amount=_money(amount),
                income_date=income_date,
                reference=reference,
                company_id=companies[company_number].id if company_number else None,
                notes=f"{DEMO_MARKER}. {notes}",
                created_by_id=creator.id,
            )
        )
        created += 1
    db.flush()
    print(f"  Ingresos demo creados: {created}")


def _ensure_assets(db, companies: dict[int, Company]) -> None:
    created = 0
    for item in DEMO_ASSETS:
        name, category, description, serial, company_number, acquired_at, value, condition, location = item
        asset = db.query(Asset).filter(Asset.serial_number == serial).first()
        if asset:
            continue
        db.add(
            Asset(
                name=name,
                category=category,
                description=description,
                serial_number=serial,
                company_id=companies[company_number].id if company_number else None,
                acquisition_date=acquired_at,
                acquisition_value=_money(value),
                current_condition=condition,
                location=location,
                is_active=condition != "baja",
                notes=DEMO_MARKER,
            )
        )
        created += 1
    db.flush()
    print(f"  Bienes de inventario demo creados: {created}")


def _approval_roles_for(expense: Expense) -> list[tuple[int, str, str]]:
    roles = [
        (1, "equipo_tesoreria", "Revision Equipo Tesoreria"),
        (2, "tesorero", "Aprobacion Tesorero"),
    ]
    if _money(expense.amount) > _money(2_500_000):
        roles.append((3, "directorio", "Aprobacion Directorio"))
    return roles


def _step_state(status_value: str, order: int) -> str:
    if status_value == "approved":
        return "approved"
    if status_value == "pending_review":
        return "pending"
    if status_value == "pending_approval":
        return "approved" if order == 1 else "pending"
    if status_value == "pending_directorio":
        return "approved" if order in {1, 2} else "pending"
    if status_value == "rejected":
        return "rejected" if order == 1 else "skipped"
    if status_value == "voided":
        return "skipped"
    return "pending"


def _actor_for_role(users: dict[str, User], role: str) -> User:
    if role == "equipo_tesoreria":
        return users.get("matias@alteatech.cl") or users["equipo.tesoreria@cbt.cl"]
    if role == "directorio":
        return users["directorio@cbt.cl"]
    return users["tesorero@cbt.cl"]


def _add_approval_steps(db, expense: Expense, users: dict[str, User]) -> None:
    acted_at = datetime.combine(expense.expense_date, datetime.min.time(), tzinfo=timezone.utc)
    for order, role, label in _approval_roles_for(expense):
        step_status = _step_state(expense.status, order)
        acted = step_status in {"approved", "rejected"}
        db.add(
            ApprovalStep(
                expense_id=expense.id,
                step_order=order,
                role_required=role,
                label=label,
                status=step_status,
                acted_by_id=_actor_for_role(users, role).id if acted else None,
                acted_at=acted_at if acted else None,
                notes=DEMO_MARKER if acted else None,
            )
        )


def _approved_by_for(status_value: str, amount: int, users: dict[str, User]) -> User | None:
    if status_value == "approved":
        return users["directorio@cbt.cl"] if amount > 2_500_000 else users["tesorero@cbt.cl"]
    if status_value == "rejected":
        return users["tesorero@cbt.cl"]
    return None


def _ensure_expenses(
    db,
    fiscal_year: FiscalYear,
    companies: dict[int, Company],
    budget_items: dict[int, BudgetItem],
    users: dict[str, User],
) -> dict[str, Expense]:
    created = 0
    requester = users.get("matias@alteatech.cl") or users["equipo.tesoreria@cbt.cl"]

    for data in DEMO_EXPENSES:
        item_number, company_number, amount, description, rut, supplier, invoice, expense_date, status_value, superintendent, reception, notes = data
        expense = (
            db.query(Expense)
            .filter(Expense.description == description, Expense.notes.contains(DEMO_MARKER))
            .first()
        )
        if expense:
            continue

        approved_by = _approved_by_for(status_value, amount, users)
        budget_item = budget_items[item_number]
        expense = Expense(
            budget_item_id=budget_item.id,
            fiscal_year_id=fiscal_year.id,
            company_id=companies[company_number].id if company_number else None,
            amount=_money(amount),
            description=description,
            supplier_rut=rut,
            supplier_name=supplier,
            invoice_number=invoice,
            expense_date=expense_date,
            status=status_value,
            requires_quotations=amount > 1_000_000,
            has_reception_act=reception,
            authorized_by_superintendent=superintendent,
            requested_by_id=requester.id,
            approved_by_id=approved_by.id if approved_by else None,
            notes=f"{DEMO_MARKER}. {notes}",
            created_at=_now(),
            updated_at=_now(),
        )
        db.add(expense)
        db.flush()
        _add_approval_steps(db, expense, users)

        if status_value == "approved":
            budget_item.executed_amount = _money(budget_item.executed_amount) + _money(amount)
        created += 1

    db.flush()
    print(f"  Gastos demo creados: {created}")
    return {
        expense.description: expense
        for expense in db.query(Expense).filter(Expense.notes.contains(DEMO_MARKER)).all()
    }


def _link_assets_to_expenses(db, expenses: dict[str, Expense]) -> None:
    linked = 0
    for serial, expense_description in DEMO_ASSET_EXPENSE_LINKS.items():
        asset = db.query(Asset).filter(Asset.serial_number == serial).first()
        expense = expenses.get(expense_description)
        if not asset or not expense or asset.acquisition_expense_id == expense.id:
            continue
        asset.acquisition_expense_id = expense.id
        linked += 1
    db.flush()
    print(f"  Bienes demo vinculados a gastos: {linked}")


def _ensure_transactions(
    db,
    accounts: dict[str, BankAccount],
    expenses: dict[str, Expense],
) -> None:
    created = 0
    touched_account_ids = set()
    for alias, reference, tx_date, amount, tx_type, description, expense_description in DEMO_TRANSACTIONS:
        tx = db.query(BankTransaction).filter(BankTransaction.reference == reference).first()
        if tx:
            touched_account_ids.add(tx.bank_account_id)
            continue

        account = accounts[alias]
        expense = expenses.get(expense_description) if expense_description else None
        db.add(
            BankTransaction(
                bank_account_id=account.id,
                transaction_date=tx_date,
                amount=_money(amount),
                transaction_type=tx_type,
                reference=reference,
                description=f"{DEMO_MARKER}. {description}",
                reconciled=bool(expense),
                reconciled_expense_id=expense.id if expense else None,
                created_at=_now(),
            )
        )
        touched_account_ids.add(account.id)
        created += 1

    db.flush()
    for account_id in touched_account_ids:
        account = db.query(BankAccount).filter(BankAccount.id == account_id).first()
        credits = (
            db.query(func.coalesce(func.sum(BankTransaction.amount), 0))
            .filter(BankTransaction.bank_account_id == account_id, BankTransaction.transaction_type == "credit")
            .scalar()
        )
        debits = (
            db.query(func.coalesce(func.sum(BankTransaction.amount), 0))
            .filter(BankTransaction.bank_account_id == account_id, BankTransaction.transaction_type == "debit")
            .scalar()
        )
        account.balance = _money(credits) - _money(debits)

    db.flush()
    print(f"  Movimientos bancarios demo creados: {created}")


def _ensure_renditions(
    db,
    fiscal_year: FiscalYear,
    companies: dict[int, Company],
    users: dict[str, User],
) -> None:
    created = 0
    submitter = users.get("matias@alteatech.cl") or users["equipo.tesoreria@cbt.cl"]
    approver = users["tesorero@cbt.cl"]

    for company_number, period_start, period_end, status_value, label in DEMO_RENDITIONS:
        existing = (
            db.query(Rendition)
            .filter(
                Rendition.company_id == companies[company_number].id,
                Rendition.period_start == period_start,
                Rendition.period_end == period_end,
                Rendition.notes.contains(DEMO_MARKER),
            )
            .first()
        )
        if existing:
            continue

        expenses = (
            db.query(Expense)
            .filter(
                Expense.fiscal_year_id == fiscal_year.id,
                Expense.company_id == companies[company_number].id,
                Expense.status == "approved",
                Expense.expense_date >= period_start,
                Expense.expense_date <= period_end,
                Expense.notes.contains(DEMO_MARKER),
            )
            .all()
        )
        total = sum(_money(expense.amount) for expense in expenses)
        submitted = status_value in {"submitted", "approved", "rejected"}
        approved = status_value == "approved"

        rendition = Rendition(
            fiscal_year_id=fiscal_year.id,
            company_id=companies[company_number].id,
            period_start=period_start,
            period_end=period_end,
            total_amount=total,
            status=status_value,
            notes=f"{DEMO_MARKER}. {label}",
            submitted_by_id=submitter.id if submitted else None,
            approved_by_id=approver.id if approved else None,
            submitted_at=_now() if submitted else None,
            approved_at=_now() if approved else None,
            created_at=_now(),
        )
        db.add(rendition)
        db.flush()

        for expense in expenses:
            db.add(RenditionItem(rendition_id=rendition.id, expense_id=expense.id))
        created += 1

    db.flush()
    print(f"  Rendiciones demo creadas: {created}")


def seed_demo_modules() -> None:
    db = SessionLocal()
    try:
        fiscal_year, companies, budget_items = _get_base_data(db)
        users = _ensure_users(db)
        accounts = _ensure_accounts(db)
        creator = users["tesorero@cbt.cl"]

        _ensure_incomes(db, fiscal_year, companies, creator)
        _ensure_assets(db, companies)
        expenses = _ensure_expenses(db, fiscal_year, companies, budget_items, users)
        _link_assets_to_expenses(db, expenses)
        _ensure_transactions(db, accounts, expenses)
        _ensure_renditions(db, fiscal_year, companies, users)

        db.commit()
        print("\nDatos demo de modulos cargados correctamente.")
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed_demo_modules()
