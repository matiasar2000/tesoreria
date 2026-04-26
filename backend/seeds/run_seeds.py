"""
Carga de datos iniciales del Cuerpo de Bomberos de Talcahuano.
Ejecutar: python -m seeds.run_seeds
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import Base, engine, SessionLocal
from app.core.security import hash_password
from app.models.user import User
from app.models.company import Company
from app.models.fiscal_year import FiscalYear
from app.models.budget_item import BudgetItem
from app.models.system_config import SystemConfig
from app.models.alert import Alert
from app.models.audit_log import AuditLog
from app.models.bank_account import BankAccount
from app.models.expense import Expense


def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    try:
        if db.query(User).first():
            print("La base de datos ya tiene datos. Saltando seed.")
            return

        # --- Compañías ---
        companies_data = [
            (1, "Primera Compañía"),
            (2, "Segunda Compañía"),
            (3, "Tercera Compañía"),
            (4, "Cuarta Compañía"),
            (5, "Quinta Compañía"),
            (6, "Sexta Compañía"),
            (7, "Séptima Compañía"),
            (8, "Octava Compañía"),
            (9, "Novena Compañía"),
            (11, "Undécima Compañía"),
        ]
        for num, name in companies_data:
            db.add(Company(number=num, name=name))
        db.flush()
        print(f"  {len(companies_data)} compañías creadas.")

        # --- Usuario administrador (Tesorero General) ---
        admin = User(
            email="tesorero@cbt.cl",
            hashed_password=hash_password("tesorero2026"),
            full_name="Israel Navarro Maldonado",
            role="tesorero",
        )
        db.add(admin)
        db.flush()
        print("  Usuario tesorero creado: tesorero@cbt.cl / tesorero2026")

        # --- Año fiscal 2026 ---
        fy = FiscalYear(
            year=2026,
            total_budget=961_094_892,
            status="draft",
            imm_value=500_000,
            notes="NO aprobado por el HDG (Acuerdo N° 14-2026, Sesión Ordinaria N° 02, 16 de marzo de 2026)",
        )
        db.add(fy)
        db.flush()
        print("  Año fiscal 2026 creado.")

        # --- 45 partidas presupuestarias ---
        budget_items = [
            (1, "Remuneraciones del personal contratado", "superintendencia", 358_891_392),
            (2, "Honorarios", "mixto", 40_000_000),
            (3, "Retenciones por honorarios", "superintendencia", 5_000_000),
            (4, "Indemnizaciones", "superintendencia", 5_000_000),
            (5, "Uniformes de parada", "superintendencia", 1_000_000),
            (6, "Combustibles y lubricantes", "comandancia", 48_000_000),
            (7, "Materiales y útiles de oficina", "mixto", 1_854_000),
            (8, "Materiales y útiles para primeros auxilios", "comandancia", 1_030_000),
            (9, "Consumo de electricidad", "superintendencia", 515_000),
            (10, "Servicio telefónico", "mixto", 3_090_000),
            (11, "Consumo de gas", "superintendencia", 103_000),
            (12, "Consumo de agua", "superintendencia", 257_500),
            (13, "Alimentos para la guardia nocturna", "mixto", 3_090_000),
            (14, "Alimentación y consumo", "superintendencia", 1_000_000),
            (15, "Uniformes del personal rentado", "superintendencia", 4_635_000),
            (16, "Materiales y útiles de aseo", "superintendencia", 1_500_000),
            (17, "Otros gastos", "mixto", 20_000_000),
            (18, "Comunicaciones, TV cable e internet", "superintendencia", 5_000_000),
            (19, "Servicio de aseo", "superintendencia", 1_000_000),
            (20, "Arriendo de inmuebles", "superintendencia", 37_080_000),
            (21, "Pasajes y fletes", "mixto", 1_575_000),
            (22, "Seguros generales y contribuciones", "mixto", 1_030_000),
            (23, "Movilización", "superintendencia", 2_000_000),
            (24, "Caja chica", "mixto", 3_090_000),
            (25, "Gastos representación", "mixto", 2_000_000),
            (26, "Gastos legales y notariales", "superintendencia", 309_000),
            (27, "Corriente", "mixto", 800_000),
            (28, "Premios y trofeos", "mixto", 3_000_000),
            (29, "Adquisición de muebles y equipos", "mixto", 3_000_000),
            (30, "Adquisición de software", "superintendencia", 20_600_000),
            (31, "Software Comandancia Viper", "comandancia", 18_025_000),
            (32, "Adquisición de equipos de comunicación y audiovisuales", "comandancia", 4_120_000),
            (33, "Adquisición de material mayor", "comandancia", 40_000_000),
            (34, "Adquisición de material menor", "comandancia", 40_000_000),
            (35, "Servicio construcción y reparación infraestructura cuarteles", "superintendencia", 69_000_000),
            (36, "Reparación de material mayor", "comandancia", 30_000_000),
            (37, "Reparación de material menor", "comandancia", 9_000_000),
            (38, "Capacitación de miembros voluntarios", "comandancia", 15_000_000),
            (39, "Publicidad y difusión", "mixto", 3_000_000),
            (40, "Viáticos voluntarios", "mixto", 500_000),
            (41, "Alimentos y bebidas para celebración", "mixto", 4_000_000),
            (42, "Otros gastos actividades no propias del servicio", "mixto", 2_000_000),
            (43, "Imprevistos", "mixto", 1_000_000),
            (44, "Provisión", "superintendencia", 50_000_000),
            (45, "Acreencias de compañías", "superintendencia", 100_000_000),
        ]

        execution_data = {
            1: 56_017_875,
            4: 5_250_000,
            6: 10_080_000,
            17: 3_600_000,
            20: 9_640_800,
            31: 4_326_000,
        }

        for num, name, authority, amount in budget_items:
            executed = execution_data.get(num, 0)
            db.add(BudgetItem(
                fiscal_year_id=fy.id,
                number=num,
                name=name,
                authority=authority,
                allocated_amount=amount,
                executed_amount=executed,
                is_blocked=(executed >= amount),
            ))
        db.flush()
        print(f"  {len(budget_items)} partidas presupuestarias creadas.")

        # --- Cuentas bancarias ---
        bank_accounts = [
            ("BancoEstado", "00-000-00000-00", "corriente", "Cuenta Corriente CBT"),
            ("Banco Santander", "00-000-00001-00", "corriente", "Cuenta Operacional"),
            ("BancoEstado", "00-000-00002-00", "ahorro", "Cuenta Ahorro Reserva"),
        ]
        for bank, number, acc_type, alias in bank_accounts:
            db.add(BankAccount(bank_name=bank, account_number=number, account_type=acc_type, alias=alias, balance=0))
        db.flush()
        print(f"  {len(bank_accounts)} cuentas bancarias creadas.")

        # --- Configuración del sistema ---
        configs = [
            ("imm_value", "500000", "Ingreso Mínimo Mensual vigente (CLP)"),
            ("superintendent_limit_imm", "5", "Cantidad de IMM que puede autorizar el Superintendente"),
            ("quotation_threshold", "1000000", "Monto sobre el cual se requieren 3 cotizaciones (CLP)"),
        ]
        for key, value, desc in configs:
            db.add(SystemConfig(key=key, value=value, description=desc))
        db.flush()
        print("  Configuración del sistema creada.")

        db.commit()
        print("\nSeed completado exitosamente.")

    except Exception as e:
        db.rollback()
        print(f"Error en seed: {e}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    seed()
