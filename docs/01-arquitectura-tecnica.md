# Arquitectura Técnica — ERP Tesorería CBT

## 1. Visión General

Sistema web independiente para la gestión financiera de la Tesorería General del Cuerpo de Bomberos de Talcahuano. Opera de forma completamente autónoma respecto a Manager+, con capacidad de importar datos vía Excel/CSV.

## 2. Stack Tecnológico

### Backend

| Componente | Tecnología | Versión |
|---|---|---|
| Lenguaje | Python | 3.12+ |
| Framework API | FastAPI | 0.115+ |
| ORM | SQLAlchemy | 2.0+ |
| Migraciones | Alembic | 1.13+ |
| Validación | Pydantic | 2.x |
| Autenticación | JWT (python-jose + passlib) | — |
| Tareas async | Celery | 5.4+ |
| Broker/Cache | Redis | 7+ |
| Servidor ASGI | Uvicorn | 0.30+ |
| Procesamiento Excel | openpyxl / pandas | — |
| Testing | pytest + httpx | — |

### Frontend

| Componente | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 15+ |
| Lenguaje | TypeScript | 5.x |
| Estilos | Tailwind CSS | 4.x |
| Componentes UI | shadcn/ui | latest |
| Gráficos | Recharts | 2.x |
| Tablas | TanStack Table | 8.x |
| Estado servidor | TanStack Query | 5.x |
| Formularios | React Hook Form + Zod | — |
| Iconos | Lucide React | — |

### Base de Datos

| Componente | Tecnología |
|---|---|
| RDBMS | PostgreSQL 16 |
| Tipos monetarios | `NUMERIC(15,2)` para montos CLP |
| Zona horaria | `America/Santiago` (UTC-3/UTC-4) |

### Infraestructura

| Componente | Tecnología |
|---|---|
| Contenedores | Docker + Docker Compose |
| Backend hosting | Railway |
| Frontend hosting | Vercel |
| Almacenamiento archivos | Cloudflare R2 |
| CI/CD | GitHub Actions |
| Monitoreo | Sentry (free tier) |

## 3. Arquitectura del Sistema

```
                         ┌─────────────┐
                         │  Navegador  │
                         │  (Usuario)  │
                         └──────┬──────┘
                                │ HTTPS
                 ┌──────────────┼──────────────┐
                 │              │              │
          ┌──────▼──────┐      │       ┌──────▼──────┐
          │   Vercel     │      │       │  Cloudflare │
          │  (Frontend)  │      │       │     R2      │
          │   Next.js    │      │       │  (Archivos) │
          └──────┬──────┘      │       └─────────────┘
                 │              │
                 │  REST API    │
                 │  (JSON)      │
          ┌──────▼──────────────▼──────┐
          │       Railway              │
          │  ┌──────────────────────┐  │
          │  │   FastAPI (Backend)  │  │
          │  │                      │  │
          │  │  ┌────┐ ┌────┐      │  │
          │  │  │Auth│ │API │      │  │
          │  │  │    │ │Rest│      │  │
          │  │  └────┘ └────┘      │  │
          │  │  ┌────┐ ┌────┐      │  │
          │  │  │Biz │ │File│      │  │
          │  │  │Logic│ │Proc│     │  │
          │  │  └────┘ └────┘      │  │
          │  └──────────────────────┘  │
          │                            │
          │  ┌──────────────────────┐  │
          │  │   Celery Workers     │  │
          │  │  Reportes · Alertas  │  │
          │  │  Excel · Notif.      │  │
          │  └──────────────────────┘  │
          │                            │
          │  ┌────────┐  ┌──────────┐  │
          │  │Postgres│  │  Redis   │  │
          │  │  (DB)  │  │ (Broker) │  │
          │  └────────┘  └──────────┘  │
          └────────────────────────────┘
```

## 4. Patrones Arquitectónicos

### 4.1 Backend — Arquitectura por Capas

```
app/
├── api/            # Capa de presentación (routers FastAPI)
├── services/       # Capa de lógica de negocio
├── repositories/   # Capa de acceso a datos
├── models/         # Modelos SQLAlchemy (ORM)
├── schemas/        # Schemas Pydantic (validación/serialización)
└── core/           # Configuración, seguridad, dependencias
```

- **Routers** (api/) → reciben HTTP, validan con Pydantic, delegan a services
- **Services** (services/) → lógica de negocio, reglas del CBT, cálculos
- **Repositories** (repositories/) → queries a PostgreSQL vía SQLAlchemy
- **Models** (models/) → tablas de la base de datos
- **Schemas** (schemas/) → contratos de entrada/salida de la API

### 4.2 Frontend — Feature-based

```
src/
├── app/              # App Router de Next.js (páginas y layouts)
├── components/       # Componentes compartidos
├── features/         # Módulos por funcionalidad
│   ├── budget/       # Presupuesto y ejecución
│   ├── expenses/     # Gastos y aprobaciones
│   ├── dashboard/    # Panel principal
│   └── ...
├── lib/              # Utilidades, API client, auth
└── types/            # Tipos TypeScript compartidos
```

### 4.3 Autenticación y Autorización

- **JWT** con access token (30 min) + refresh token (7 días)
- Access token en memoria (no localStorage), refresh en httpOnly cookie
- **RBAC** (Role-Based Access Control) con 5 roles:

| Rol | Descripción | Acceso |
|---|---|---|
| `tesorero` | Tesorero General y Pro-Tesorero | Acceso completo a todo el sistema |
| `superintendente` | Superintendente del CBT | Aprobación de gastos, dashboard ejecutivo |
| `equipo_tesoreria` | Personal del equipo de Tesorería | Según área asignada (finanzas, adquisiciones, RRHH, etc.) |
| `director_compania` | Director de cada compañía (10) | Estado de su compañía, entregas documentales |
| `directorio` | Miembros del Directorio General | Dashboard ejecutivo, resumen financiero (solo lectura) |

### 4.4 Manejo de Montos

- Todos los montos en **pesos chilenos (CLP)**, sin decimales en la interfaz
- Almacenamiento en `NUMERIC(15,2)` para precisión en cálculos intermedios
- Formato de visualización: `$961.094.892` (separador de miles con punto, sin decimales)
- El Ingreso Mínimo Mensual (IMM) se configura como variable del sistema y se actualiza cuando cambia

## 5. Comunicación Frontend ↔ Backend

- **Protocolo:** REST sobre HTTPS
- **Formato:** JSON
- **Autenticación:** Bearer token en header `Authorization`
- **Paginación:** cursor-based para listados grandes, offset para tablas pequeñas
- **Errores:** formato estandarizado `{ "detail": "mensaje", "code": "ERROR_CODE" }`
- **Versionado:** prefijo `/api/v1/` en todas las rutas

## 6. Entornos

| Entorno | Propósito | URL |
|---|---|---|
| `development` | Desarrollo local | `localhost:3000` (front) / `localhost:8000` (back) |
| `staging` | Pruebas pre-producción | Por definir |
| `production` | Producción | Por definir |

## 7. Seguridad

- HTTPS obligatorio en producción
- CORS configurado solo para el dominio del frontend
- Rate limiting en endpoints de autenticación
- Sanitización de inputs vía Pydantic
- Headers de seguridad (CSP, HSTS, X-Frame-Options)
- Auditoría: log de todas las operaciones financieras con usuario, timestamp e IP
- Backups automáticos diarios de PostgreSQL
