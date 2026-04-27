# Estructura del Proyecto — ERP Tesorería CBT

## 1. Repositorio

Monorepo con dos directorios principales: `backend/` y `frontend/`.

```
tesoreria-cbt/
├── .github/
│   └── workflows/
│       ├── backend-ci.yml          # Tests + lint backend
│       └── frontend-ci.yml         # Tests + lint + build frontend
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                 # Punto de entrada FastAPI
│   │   ├── config.py               # Settings con pydantic-settings
│   │   ├── database.py             # Engine, SessionLocal, Base
│   │   │
│   │   ├── api/
│   │   │   ├── __init__.py
│   │   │   ├── deps.py             # Dependencias compartidas (get_db, get_current_user)
│   │   │   └── v1/
│   │   │       ├── __init__.py
│   │   │       ├── router.py       # Router principal que agrupa todos los sub-routers
│   │   │       ├── auth.py
│   │   │       ├── users.py
│   │   │       ├── fiscal_years.py
│   │   │       ├── budget_items.py
│   │   │       ├── expenses.py
│   │   │       ├── assets.py
│   │   │       ├── documents.py
│   │   │       ├── approvals.py
│   │   │       ├── bank_accounts.py
│   │   │       ├── bank_transactions.py
│   │   │       ├── companies.py
│   │   │       ├── closings.py
│   │   │       ├── debts.py
│   │   │       ├── renditions.py
│   │   │       ├── alerts.py
│   │   │       ├── dashboard.py
│   │   │       ├── imports.py
│   │   │       ├── exports.py
│   │   │       ├── audit_log.py
│   │   │       └── config.py
│   │   │
│   │   ├── models/
│   │   │   ├── __init__.py         # Importa todos los modelos para Alembic
│   │   │   ├── user.py
│   │   │   ├── company.py
│   │   │   ├── fiscal_year.py
│   │   │   ├── budget_item.py
│   │   │   ├── expense.py
│   │   │   ├── asset.py
│   │   │   ├── document.py
│   │   │   ├── approval_flow.py
│   │   │   ├── bank_account.py
│   │   │   ├── bank_transaction.py
│   │   │   ├── company_closing.py
│   │   │   ├── debt.py
│   │   │   ├── rendition.py
│   │   │   ├── alert.py
│   │   │   ├── audit_log.py
│   │   │   └── system_config.py
│   │   │
│   │   ├── schemas/
│   │   │   ├── __init__.py
│   │   │   ├── auth.py             # LoginRequest, TokenResponse
│   │   │   ├── user.py             # UserCreate, UserUpdate, UserResponse
│   │   │   ├── fiscal_year.py
│   │   │   ├── budget_item.py      # Incluye campos calculados (available, %, color)
│   │   │   ├── expense.py
│   │   │   ├── asset.py
│   │   │   ├── document.py
│   │   │   ├── approval.py
│   │   │   ├── bank.py
│   │   │   ├── company.py
│   │   │   ├── closing.py
│   │   │   ├── debt.py
│   │   │   ├── rendition.py
│   │   │   ├── alert.py
│   │   │   ├── dashboard.py        # DTOs para cada widget del dashboard
│   │   │   ├── imports.py
│   │   │   └── common.py           # PaginatedResponse, ErrorResponse
│   │   │
│   │   ├── services/
│   │   │   ├── __init__.py
│   │   │   ├── auth_service.py
│   │   │   ├── user_service.py
│   │   │   ├── budget_service.py   # Lógica de semáforo, bloqueo, ejecución
│   │   │   ├── expense_service.py  # Validaciones de gasto, reglas de negocio
│   │   │   ├── asset_service.py    # Inventario y vínculo opcional con gastos
│   │   │   ├── approval_service.py # Lógica de flujo de aprobación
│   │   │   ├── bank_service.py     # Conciliación bancaria
│   │   │   ├── closing_service.py  # Seguimiento de cierre por compañía
│   │   │   ├── debt_service.py
│   │   │   ├── rendition_service.py # Generación automática de rendiciones
│   │   │   ├── alert_service.py    # Generación y gestión de alertas
│   │   │   ├── dashboard_service.py
│   │   │   ├── import_service.py   # Procesamiento de Excel
│   │   │   ├── export_service.py   # Generación de Excel
│   │   │   └── audit_service.py    # Registro de auditoría
│   │   │
│   │   ├── repositories/
│   │   │   ├── __init__.py
│   │   │   ├── base.py             # BaseRepository con CRUD genérico
│   │   │   ├── user_repo.py
│   │   │   ├── budget_item_repo.py
│   │   │   ├── expense_repo.py
│   │   │   ├── bank_repo.py
│   │   │   ├── closing_repo.py
│   │   │   ├── debt_repo.py
│   │   │   ├── rendition_repo.py
│   │   │   └── alert_repo.py
│   │   │
│   │   ├── core/
│   │   │   ├── __init__.py
│   │   │   ├── security.py         # JWT encode/decode, password hashing
│   │   │   ├── permissions.py      # Decoradores/dependencias de permisos por rol
│   │   │   └── exceptions.py       # Excepciones de negocio (InsufficientBudget, etc.)
│   │   │
│   │   └── tasks/
│   │       ├── __init__.py
│   │       ├── celery_app.py       # Configuración Celery
│   │       ├── alert_tasks.py      # Tareas de verificación de alertas
│   │       ├── report_tasks.py     # Generación de reportes en background
│   │       └── reminder_tasks.py   # Recordatorios de cierre, rendiciones
│   │
│   ├── alembic/
│   │   ├── env.py
│   │   ├── versions/               # Migraciones versionadas
│   │   └── alembic.ini
│   │
│   ├── seeds/
│   │   ├── seed_companies.py       # 10 compañías
│   │   ├── seed_budget_2026.py     # 45 ítems con montos
│   │   ├── seed_bank_accounts.py   # 3 cuentas Itaú
│   │   ├── seed_config.py          # IMM, límite Superintendente
│   │   ├── seed_demo_modules.py    # Datos demo de gastos, ingresos, inventario, banco y rendiciones
│   │   └── run_seeds.py            # Script principal de carga inicial
│   │
│   ├── tests/
│   │   ├── conftest.py             # Fixtures (db de test, client, auth)
│   │   ├── test_auth.py
│   │   ├── test_budget.py
│   │   ├── test_expenses.py
│   │   ├── test_approvals.py
│   │   ├── test_bank.py
│   │   └── test_import.py
│   │
│   ├── Dockerfile
│   ├── requirements.txt
│   ├── pyproject.toml
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── layout.tsx              # Layout raíz (sidebar, header)
│   │   │   ├── page.tsx                # Redirect a /dashboard
│   │   │   ├── login/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx            # Dashboard principal
│   │   │   ├── presupuesto/
│   │   │   │   ├── page.tsx            # Listado de partidas con semáforo
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        # Detalle de partida
│   │   │   ├── gastos/
│   │   │   │   ├── page.tsx            # Listado de gastos
│   │   │   │   ├── nuevo/
│   │   │   │   │   └── page.tsx        # Formulario de nuevo gasto
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        # Detalle de gasto + documentos + aprobación
│   │   │   ├── aprobaciones/
│   │   │   │   └── page.tsx            # Cola de aprobaciones pendientes
│   │   │   ├── bancos/
│   │   │   │   ├── page.tsx            # Cuentas y saldos
│   │   │   │   ├── [id]/
│   │   │   │   │   └── page.tsx        # Movimientos de cuenta
│   │   │   │   └── importar/
│   │   │   │       └── page.tsx        # Importar cartola Excel
│   │   │   ├── companias/
│   │   │   │   ├── page.tsx            # Tablero de cierre por compañía
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        # Estado de cierre de una compañía
│   │   │   ├── deudas/
│   │   │   │   └── page.tsx            # Deudas y acreencias
│   │   │   ├── inventario/
│   │   │   │   └── page.tsx            # Inventario de bienes con origen por gasto
│   │   │   ├── rendiciones/
│   │   │   │   ├── page.tsx            # Listado de rendiciones
│   │   │   │   └── [id]/
│   │   │   │       └── page.tsx        # Detalle de rendición
│   │   │   ├── alertas/
│   │   │   │   └── page.tsx            # Centro de alertas
│   │   │   ├── importar/
│   │   │   │   └── page.tsx            # Importación de datos Excel
│   │   │   ├── auditoria/
│   │   │   │   └── page.tsx            # Registro de auditoría
│   │   │   └── configuracion/
│   │   │       ├── page.tsx            # Configuración del sistema
│   │   │       └── usuarios/
│   │   │           └── page.tsx        # Gestión de usuarios
│   │   │
│   │   ├── components/
│   │   │   ├── ui/                     # Componentes shadcn/ui (button, card, input, etc.)
│   │   │   ├── layout/
│   │   │   │   ├── sidebar.tsx
│   │   │   │   ├── header.tsx
│   │   │   │   ├── breadcrumb.tsx
│   │   │   │   └── mobile-nav.tsx
│   │   │   ├── budget/
│   │   │   │   ├── traffic-light.tsx   # Semáforo verde/amarillo/rojo
│   │   │   │   ├── budget-table.tsx
│   │   │   │   └── execution-chart.tsx
│   │   │   ├── expenses/
│   │   │   │   ├── expense-form.tsx
│   │   │   │   ├── expense-table.tsx
│   │   │   │   └── approval-timeline.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── summary-cards.tsx
│   │   │   │   ├── bank-balances.tsx
│   │   │   │   ├── monthly-chart.tsx
│   │   │   │   └── alerts-widget.tsx
│   │   │   ├── bank/
│   │   │   │   ├── account-card.tsx
│   │   │   │   └── transaction-table.tsx
│   │   │   ├── closings/
│   │   │   │   ├── closing-board.tsx   # Tablero visual por compañía
│   │   │   │   └── document-checklist.tsx
│   │   │   └── shared/
│   │   │       ├── data-table.tsx      # Tabla genérica con TanStack Table
│   │   │       ├── money-display.tsx   # Formato CLP: $1.234.567
│   │   │       ├── date-display.tsx    # Formato dd/MM/yyyy
│   │   │       ├── status-badge.tsx
│   │   │       ├── file-upload.tsx
│   │   │       ├── confirm-dialog.tsx
│   │   │       └── loading-skeleton.tsx
│   │   │
│   │   ├── lib/
│   │   │   ├── api-client.ts           # Axios/fetch wrapper con interceptores JWT
│   │   │   ├── auth.ts                 # Context de autenticación, hooks
│   │   │   ├── utils.ts                # Formateo de montos, fechas, etc.
│   │   │   └── constants.ts            # Roles, estados, colores de semáforo
│   │   │
│   │   └── types/
│   │       ├── api.ts                  # Tipos generados desde OpenAPI o manuales
│   │       ├── budget.ts
│   │       ├── expense.ts
│   │       ├── bank.ts
│   │       └── auth.ts
│   │
│   ├── public/
│   │   └── logo-cbt.png               # Logo del CBT
│   │
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   ├── tsconfig.json
│   ├── package.json
│   ├── Dockerfile
│   └── .env.example
│
├── docker-compose.yml                  # Desarrollo local: backend + frontend + postgres + redis
├── docker-compose.prod.yml             # Producción
├── .gitignore
├── .env.example
└── README.md
```

## 2. Docker Compose (Desarrollo Local)

```yaml
# docker-compose.yml
services:
  backend:
    build: ./backend
    ports:
      - "8000:8000"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/tesoreria
      - REDIS_URL=redis://redis:6379/0
      - SECRET_KEY=dev-secret-key
      - CORS_ORIGINS=http://localhost:3000
    volumes:
      - ./backend/app:/app/app
    depends_on:
      - db
      - redis

  frontend:
    build: ./frontend
    ports:
      - "3000:3000"
    environment:
      - NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1
    volumes:
      - ./frontend/src:/app/src

  db:
    image: postgres:16-alpine
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_DB=tesoreria
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
    volumes:
      - postgres_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

  celery:
    build: ./backend
    command: celery -A app.tasks.celery_app worker --loglevel=info
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/tesoreria
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis

volumes:
  postgres_data:
```

## 3. Variables de Entorno

### Backend (.env)
```
DATABASE_URL=postgresql://user:pass@host:5432/tesoreria
REDIS_URL=redis://host:6379/0
SECRET_KEY=clave-secreta-larga-y-aleatoria
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
CORS_ORIGINS=https://tesoreria-cbt.vercel.app
R2_ACCOUNT_ID=xxx
R2_ACCESS_KEY_ID=xxx
R2_SECRET_ACCESS_KEY=xxx
R2_BUCKET_NAME=tesoreria-docs
SENTRY_DSN=xxx
ENVIRONMENT=production
```

### Frontend (.env)
```
NEXT_PUBLIC_API_URL=https://api-tesoreria-cbt.railway.app/api/v1
NEXT_PUBLIC_APP_NAME=Tesorería CBT
```
