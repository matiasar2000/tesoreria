# Modelo de Datos — ERP Tesorería CBT

## 1. Diagrama Entidad-Relación (simplificado)

```
┌──────────────┐     ┌──────────────────┐     ┌──────────────────┐
│    users     │     │   fiscal_years   │     │    companies     │
│──────────────│     │──────────────────│     │──────────────────│
│ id           │     │ id               │     │ id               │
│ email        │     │ year             │     │ number (1-11)    │
│ full_name    │     │ total_budget     │     │ name             │
│ role         │     │ status           │     │ director_user_id │
│ company_id?  │     │ approved_at      │     └────────┬─────────┘
│ is_active    │     └────────┬─────────┘              │
└──────┬───────┘              │                        │
       │              ┌───────▼──────────┐     ┌───────▼─────────────┐
       │              │  budget_items    │     │ company_closings    │
       │              │──────────────────│     │─────────────────────│
       │              │ id               │     │ id                  │
       │              │ fiscal_year_id   │     │ company_id          │
       │              │ number (1-45)    │     │ fiscal_year_id      │
       │              │ name             │     │ status              │
       │              │ allocated_amount │     │ documents_submitted │
       │              │ authority        │     │ submitted_at        │
       │              └────────┬─────────┘     └─────────────────────┘
       │                       │
       │              ┌────────▼─────────┐     ┌──────────────────┐
       │              │    expenses      │────▶│    documents     │
       │              │──────────────────│     │──────────────────│
       │              │ id               │     │ id               │
       │              │ budget_item_id   │     │ expense_id       │
       │              │ amount           │     │ type             │
       │              │ description      │     │ file_url         │
       │              │ supplier         │     │ verified         │
       │              │ status           │     └──────────────────┘
       │              │ requested_by     │
       │              │ approved_by      │     ┌──────────────────┐
       │              │ company_id?      │     │  approval_flows  │
       │              └────────┬─────────┘     │──────────────────│
       │                       │               │ id               │
       │                       └──────────────▶│ expense_id       │
       │                                       │ step             │
       │  ┌──────────────────┐                 │ approver_id      │
       │  │  bank_accounts   │                 │ decision         │
       │  │──────────────────│                 │ decided_at       │
       │  │ id               │                 └──────────────────┘
       │  │ name             │
       │  │ bank             │     ┌──────────────────┐
       │  │ account_number   │     │      debts       │
       │  │ current_balance  │     │──────────────────│
       │  └────────┬─────────┘     │ id               │
       │           │               │ creditor         │
       │  ┌────────▼─────────┐     │ amount           │
       │  │bank_transactions │     │ due_date         │
       │  │──────────────────│     │ budget_item_id   │
       │  │ id               │     │ status           │
       │  │ bank_account_id  │     └──────────────────┘
       │  │ date             │
       │  │ amount           │     ┌──────────────────┐
       │  │ reference        │     │     alerts       │
       │  │ reconciled       │     │──────────────────│
       │  └──────────────────┘     │ id               │
       │                           │ type             │
       │                           │ severity         │
       └──────────────────────────▶│ user_id          │
                                   │ message          │
                                   │ read             │
                                   └──────────────────┘
```

## 2. Detalle de Tablas

### 2.1 `users` — Usuarios del sistema

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `email` | `VARCHAR(255)` | NO | Único, login |
| `hashed_password` | `VARCHAR(255)` | NO | bcrypt hash |
| `full_name` | `VARCHAR(255)` | NO | Nombre completo |
| `role` | `ENUM` | NO | `tesorero`, `superintendente`, `equipo_tesoreria`, `director_compania`, `directorio` |
| `company_id` | `UUID` | SÍ | FK → companies. Solo para directores de compañía |
| `area` | `VARCHAR(100)` | SÍ | Área dentro de Tesorería (finanzas, adquisiciones, rrhh, soporte) |
| `is_active` | `BOOLEAN` | NO | Default `true` |
| `created_at` | `TIMESTAMPTZ` | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | |

### 2.2 `companies` — Las 10 compañías del CBT

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `number` | `SMALLINT` | NO | Número de compañía (1,2,3,4,5,6,7,8,9,11). Único |
| `name` | `VARCHAR(255)` | NO | Nombre oficial de la compañía |
| `director_user_id` | `UUID` | SÍ | FK → users. Director actual |
| `is_active` | `BOOLEAN` | NO | Default `true` |

### 2.3 `fiscal_years` — Años fiscales

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `year` | `SMALLINT` | NO | Ej: 2026. Único |
| `total_budget` | `NUMERIC(15,2)` | NO | Presupuesto total aprobado |
| `status` | `ENUM` | NO | `draft`, `submitted`, `approved`, `rejected` |
| `approved_at` | `TIMESTAMPTZ` | SÍ | Fecha de aprobación por el HDG |
| `approved_by` | `VARCHAR(255)` | SÍ | Referencia al acuerdo del HDG |
| `imm_value` | `NUMERIC(10,0)` | NO | Valor del Ingreso Mínimo Mensual vigente |
| `notes` | `TEXT` | SÍ | Observaciones (ej: "No aprobado - Acuerdo N° 14-2026") |

### 2.4 `budget_items` — Partidas presupuestarias (45 ítems)

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `fiscal_year_id` | `UUID` | NO | FK → fiscal_years |
| `number` | `SMALLINT` | NO | 1 a 45 |
| `name` | `VARCHAR(255)` | NO | Nombre del ítem (ej: "Remuneraciones del personal contratado") |
| `authority` | `ENUM` | NO | `superintendencia`, `comandancia`, `mixto` |
| `allocated_amount` | `NUMERIC(15,2)` | NO | Monto asignado |
| `executed_amount` | `NUMERIC(15,2)` | NO | Monto ejecutado (calculado, se actualiza con cada gasto) |
| `yellow_threshold` | `NUMERIC(5,2)` | NO | % para semáforo amarillo. Default `80.00` |
| `red_threshold` | `NUMERIC(5,2)` | NO | % para semáforo rojo. Default `100.00` |
| `is_blocked` | `BOOLEAN` | NO | Si está bloqueado para nuevos gastos. Default `false` |

**Constraint:** `UNIQUE(fiscal_year_id, number)`

**Campo calculado (en la API, no en BD):**
- `available_amount` = `allocated_amount` - `executed_amount`
- `execution_percentage` = (`executed_amount` / `allocated_amount`) * 100
- `status_color` = verde / amarillo / rojo según umbrales

### 2.5 `expenses` — Gastos

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `budget_item_id` | `UUID` | NO | FK → budget_items |
| `fiscal_year_id` | `UUID` | NO | FK → fiscal_years |
| `company_id` | `UUID` | SÍ | FK → companies (si aplica) |
| `amount` | `NUMERIC(15,2)` | NO | Monto del gasto |
| `description` | `TEXT` | NO | Descripción del gasto |
| `supplier_rut` | `VARCHAR(12)` | SÍ | RUT del proveedor |
| `supplier_name` | `VARCHAR(255)` | SÍ | Nombre del proveedor |
| `invoice_number` | `VARCHAR(50)` | SÍ | Número de factura |
| `expense_date` | `DATE` | NO | Fecha del gasto |
| `status` | `ENUM` | NO | `draft`, `pending_approval`, `approved`, `rejected`, `paid`, `rendered` |
| `requires_quotations` | `BOOLEAN` | NO | `true` si monto > $1.000.000 |
| `has_reception_act` | `BOOLEAN` | NO | Si tiene Acta de Recepción Conforme |
| `authorized_by_superintendent` | `BOOLEAN` | NO | Si fue autorizado directamente por el Superintendente |
| `requested_by_id` | `UUID` | NO | FK → users. Quien solicitó |
| `notes` | `TEXT` | SÍ | Observaciones |
| `created_at` | `TIMESTAMPTZ` | NO | |
| `updated_at` | `TIMESTAMPTZ` | NO | |

### 2.6 `approval_flows` — Flujo de aprobación de gastos

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `expense_id` | `UUID` | NO | FK → expenses |
| `step` | `SMALLINT` | NO | Orden del paso (1, 2, 3...) |
| `role_required` | `ENUM` | NO | Rol requerido para aprobar este paso |
| `approver_id` | `UUID` | SÍ | FK → users. Quien aprobó/rechazó |
| `decision` | `ENUM` | SÍ | `approved`, `rejected`, `pending` |
| `comment` | `TEXT` | SÍ | Comentario del aprobador |
| `decided_at` | `TIMESTAMPTZ` | SÍ | |

### 2.7 `documents` — Documentos de respaldo

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `expense_id` | `UUID` | NO | FK → expenses |
| `type` | `ENUM` | NO | `invoice`, `reception_act`, `quotation`, `other` |
| `file_name` | `VARCHAR(255)` | NO | Nombre original del archivo |
| `file_url` | `VARCHAR(500)` | NO | URL en Cloudflare R2 |
| `file_size` | `INTEGER` | NO | Tamaño en bytes |
| `mime_type` | `VARCHAR(100)` | NO | |
| `verified` | `BOOLEAN` | NO | Si fue verificado como válido. Default `false` |
| `verified_by_id` | `UUID` | SÍ | FK → users |
| `uploaded_at` | `TIMESTAMPTZ` | NO | |

### 2.8 `bank_accounts` — Cuentas bancarias

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `name` | `VARCHAR(255)` | NO | Ej: "Banco Itaú Municipal" |
| `bank` | `VARCHAR(100)` | NO | Ej: "Banco Itaú" |
| `account_number` | `VARCHAR(50)` | NO | |
| `account_type` | `ENUM` | NO | `municipal`, `acreencias`, `ingresos_propios` |
| `current_balance` | `NUMERIC(15,2)` | NO | Saldo actual |
| `last_reconciled_at` | `TIMESTAMPTZ` | SÍ | Última conciliación |

### 2.9 `bank_transactions` — Movimientos bancarios

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `bank_account_id` | `UUID` | NO | FK → bank_accounts |
| `transaction_date` | `DATE` | NO | |
| `amount` | `NUMERIC(15,2)` | NO | Positivo = ingreso, negativo = egreso |
| `description` | `TEXT` | NO | Descripción del movimiento |
| `reference` | `VARCHAR(100)` | SÍ | Número de referencia bancaria |
| `reconciled` | `BOOLEAN` | NO | Default `false` |
| `reconciled_expense_id` | `UUID` | SÍ | FK → expenses (si fue conciliado con un gasto) |
| `source` | `ENUM` | NO | `manual`, `excel_import` |
| `imported_at` | `TIMESTAMPTZ` | SÍ | Si vino de importación Excel |

### 2.10 `company_closings` — Cierre contable por compañía

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `company_id` | `UUID` | NO | FK → companies |
| `fiscal_year_id` | `UUID` | NO | FK → fiscal_years |
| `status` | `ENUM` | NO | `pending`, `partial`, `complete`, `verified` |
| `due_date` | `DATE` | NO | Fecha límite de entrega |
| `submitted_at` | `TIMESTAMPTZ` | SÍ | |
| `has_expenses` | `BOOLEAN` | NO | Default `false` |
| `has_transfers` | `BOOLEAN` | NO | Default `false` |
| `has_income` | `BOOLEAN` | NO | Default `false` |
| `has_bank_statements` | `BOOLEAN` | NO | Default `false` |
| `has_reconciliation` | `BOOLEAN` | NO | Default `false` |
| `verified_by_id` | `UUID` | SÍ | FK → users |
| `notes` | `TEXT` | SÍ | |

**Constraint:** `UNIQUE(company_id, fiscal_year_id)`

### 2.11 `debts` — Deudas y acreencias

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `fiscal_year_id` | `UUID` | NO | FK → fiscal_years |
| `type` | `ENUM` | NO | `payable` (por pagar), `receivable` (por cobrar) |
| `creditor_debtor` | `VARCHAR(255)` | NO | Nombre del acreedor o deudor |
| `description` | `TEXT` | NO | |
| `total_amount` | `NUMERIC(15,2)` | NO | Monto total |
| `paid_amount` | `NUMERIC(15,2)` | NO | Monto pagado/cobrado. Default `0` |
| `due_date` | `DATE` | SÍ | Fecha de vencimiento |
| `budget_item_id` | `UUID` | SÍ | FK → budget_items (partida que la cubre) |
| `status` | `ENUM` | NO | `pending`, `partial`, `paid`, `overdue` |
| `funded_by_public_funds` | `BOOLEAN` | NO | Si se cubre con fondos públicos futuros |
| `notes` | `TEXT` | SÍ | |
| `created_at` | `TIMESTAMPTZ` | NO | |

### 2.12 `alerts` — Alertas del sistema

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `type` | `ENUM` | NO | `budget_yellow`, `budget_red`, `budget_blocked`, `superintendent_limit`, `deadline`, `reconciliation`, `closing_reminder`, `custom` |
| `severity` | `ENUM` | NO | `info`, `warning`, `critical` |
| `title` | `VARCHAR(255)` | NO | |
| `message` | `TEXT` | NO | |
| `target_user_id` | `UUID` | SÍ | FK → users (si es para un usuario específico) |
| `target_role` | `ENUM` | SÍ | Si es para todos los usuarios de un rol |
| `related_entity_type` | `VARCHAR(50)` | SÍ | Ej: `budget_item`, `expense`, `debt` |
| `related_entity_id` | `UUID` | SÍ | ID de la entidad relacionada |
| `read` | `BOOLEAN` | NO | Default `false` |
| `created_at` | `TIMESTAMPTZ` | NO | |

### 2.13 `renditions` — Rendiciones ante la Subsecretaría/SIRC

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `fiscal_year_id` | `UUID` | NO | FK → fiscal_years |
| `period` | `VARCHAR(50)` | NO | Ej: "Anual 2026", "Q1 2026" |
| `due_date` | `DATE` | NO | Fecha límite de presentación |
| `status` | `ENUM` | NO | `in_progress`, `ready`, `submitted`, `observed`, `accepted` |
| `total_amount` | `NUMERIC(15,2)` | SÍ | Monto total rendido |
| `expenses_count` | `INTEGER` | SÍ | Cantidad de gastos incluidos |
| `missing_documents_count` | `INTEGER` | SÍ | Gastos sin respaldo completo |
| `submitted_at` | `TIMESTAMPTZ` | SÍ | |
| `submitted_by_id` | `UUID` | SÍ | FK → users |
| `notes` | `TEXT` | SÍ | |

### 2.14 `rendition_expenses` — Gastos incluidos en una rendición

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `rendition_id` | `UUID` | NO | FK → renditions |
| `expense_id` | `UUID` | NO | FK → expenses |
| `documents_complete` | `BOOLEAN` | NO | Si tiene todos los respaldos |
| `observation` | `TEXT` | SÍ | |

### 2.15 `audit_log` — Registro de auditoría

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `user_id` | `UUID` | NO | FK → users |
| `action` | `VARCHAR(50)` | NO | `create`, `update`, `delete`, `approve`, `reject`, `login`, `export` |
| `entity_type` | `VARCHAR(50)` | NO | Nombre de la tabla afectada |
| `entity_id` | `UUID` | SÍ | ID del registro afectado |
| `old_values` | `JSONB` | SÍ | Valores anteriores (para updates) |
| `new_values` | `JSONB` | SÍ | Valores nuevos |
| `ip_address` | `VARCHAR(45)` | SÍ | |
| `created_at` | `TIMESTAMPTZ` | NO | |

### 2.16 `system_config` — Configuración del sistema

| Columna | Tipo | Nullable | Descripción |
|---|---|---|---|
| `id` | `UUID` | NO | PK |
| `key` | `VARCHAR(100)` | NO | Único. Ej: `imm_value`, `superintendent_limit_imm` |
| `value` | `TEXT` | NO | Valor serializado |
| `description` | `TEXT` | SÍ | |
| `updated_at` | `TIMESTAMPTZ` | NO | |
| `updated_by_id` | `UUID` | SÍ | FK → users |

## 3. Índices Principales

```sql
-- Búsquedas frecuentes de gastos
CREATE INDEX idx_expenses_budget_item ON expenses(budget_item_id);
CREATE INDEX idx_expenses_fiscal_year ON expenses(fiscal_year_id);
CREATE INDEX idx_expenses_status ON expenses(status);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_company ON expenses(company_id);

-- Partidas por año fiscal
CREATE INDEX idx_budget_items_fiscal_year ON budget_items(fiscal_year_id);

-- Transacciones bancarias
CREATE INDEX idx_bank_transactions_account ON bank_transactions(bank_account_id);
CREATE INDEX idx_bank_transactions_date ON bank_transactions(transaction_date);
CREATE INDEX idx_bank_transactions_reconciled ON bank_transactions(reconciled);

-- Alertas no leídas
CREATE INDEX idx_alerts_user_unread ON alerts(target_user_id, read) WHERE read = false;

-- Auditoría
CREATE INDEX idx_audit_log_entity ON audit_log(entity_type, entity_id);
CREATE INDEX idx_audit_log_user ON audit_log(user_id);
CREATE INDEX idx_audit_log_date ON audit_log(created_at);
```

## 4. Datos Semilla (seed)

Al inicializar el sistema se deben cargar:

1. **10 compañías** (1ª a 9ª + 11ª Compañía)
2. **45 ítems presupuestarios** del año fiscal 2026 con montos asignados
3. **3 cuentas bancarias** Banco Itaú (Municipal, Acreencias, Ingresos Propios)
4. **Configuración del sistema**: IMM vigente ($500.000), límite Superintendente (5 IMM)
5. **Usuario administrador** inicial (Tesorero General)
