# ERP Tesoreria CBT - Estado del Proyecto

Sistema de gestión de tesorería para el Cuerpo de Bomberos de Talcahuano (CBT).
Independiente de Manager+, enfocado en control presupuestario y registro de gastos.

---

## Estado actual

El proyecto se encuentra en **Fase 1 (MVP)** — funcional y operativo en ambiente local con Docker.

Se puede levantar todo el sistema con un solo comando (`docker-compose up --build`) y acceder desde el navegador.

**Credenciales de acceso:** `tesorero@cbt.cl` / `tesorero2026`

---

## Modulos implementados

### 1. Autenticacion y seguridad

Inicio de sesion con control de roles. Solo usuarios autorizados pueden acceder al sistema.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Login | `/login` | Inicio de sesion con email y contraseña |

**Archivos relacionados:**
- `frontend/src/app/login/page.tsx` — Pantalla de login
- `frontend/src/lib/auth.tsx` — Logica de sesion del usuario
- `backend/app/api/v1/auth.py` — Endpoints de autenticacion
- `backend/app/services/auth_service.py` — Validacion de credenciales
- `backend/app/core/security.py` — Manejo de tokens y contraseñas
- `backend/app/core/permissions.py` — Control de permisos por rol

**Roles disponibles:** tesorero, superintendente, equipo_tesoreria, director_compania, directorio

---

### 2. Dashboard (Panel principal)

Vista general con resumen financiero del periodo fiscal activo.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Dashboard | `/dashboard` | Muestra tarjetas con presupuesto total, ejecutado, disponible y graficos |

**Archivos relacionados:**
- `frontend/src/app/(app)/dashboard/page.tsx` — Pantalla del dashboard
- `backend/app/api/v1/dashboard.py` — Endpoint de resumen
- `backend/app/services/dashboard_service.py` — Calculos y agregaciones

---

### 3. Control presupuestario (Presupuesto)

Tabla con todas las partidas presupuestarias del año fiscal. Cada partida muestra un semaforo de colores segun el nivel de ejecucion:

- **Verde:** menos del 80% ejecutado — situacion normal
- **Amarillo:** entre 80% y 100% ejecutado — precaucion
- **Rojo:** 100% o mas ejecutado — partida bloqueada

Al hacer clic en una partida se accede a su detalle con el desglose de gastos asociados.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Lista de partidas | `/presupuesto` | Tabla con semaforo, montos asignados, ejecutados y disponibles |
| Detalle de partida | `/presupuesto/{id}` | Detalle de una partida con lista de gastos vinculados |

**Archivos relacionados:**
- `frontend/src/app/(app)/presupuesto/page.tsx` — Tabla de partidas con semaforo
- `frontend/src/app/(app)/presupuesto/[id]/page.tsx` — Detalle de partida individual
- `backend/app/api/v1/budget_items.py` — Endpoints de partidas
- `backend/app/services/budget_service.py` — Logica de semaforo y bloqueo automatico

---

### 4. Gestion de gastos

Registro, aprobacion, rechazo y anulacion de gastos. Cada gasto se vincula a una partida presupuestaria y pasa por un flujo de aprobacion:

**Flujo:** Pendiente de aprobacion → Aprobado / Rechazado → (opcionalmente) Anulado

Cuando se aprueba un gasto, el monto se descuenta automaticamente de la partida. Si se anula un gasto aprobado, el monto se devuelve a la partida.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Lista de gastos | `/gastos` | Tabla de gastos con filtros por estado y botones de accion |
| Nuevo gasto | `/gastos/nuevo` | Formulario para registrar un gasto |

**Archivos relacionados:**
- `frontend/src/app/(app)/gastos/page.tsx` — Lista de gastos con acciones (aprobar, rechazar, anular)
- `frontend/src/app/(app)/gastos/nuevo/page.tsx` — Formulario de nuevo gasto
- `backend/app/api/v1/expenses.py` — Endpoints de gastos (CRUD + aprobar/rechazar/anular)
- `backend/app/services/expense_service.py` — Logica de negocio: validaciones, descuento de presupuesto, alertas

---

### 5. Alertas

Centro de notificaciones del sistema. Se generan alertas automaticas cuando:

- Una partida supera el 80% de ejecucion (advertencia)
- Una partida alcanza el 100% y se bloquea (critica)
- Un gasto autorizado por el superintendente supera 5 IMM

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Alertas | `/alertas` | Lista de alertas con filtro leidas/no leidas y opcion de marcar como leida |

**Archivos relacionados:**
- `frontend/src/app/(app)/alertas/page.tsx` — Pantalla de alertas
- `backend/app/api/v1/alerts.py` — Endpoints de alertas
- `backend/app/services/alert_service.py` — Creacion de alertas automaticas

---

### 6. Importacion de datos

Carga masiva de presupuesto y gastos desde archivos Excel.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Importar | `/importar` | Formulario para subir archivos Excel de presupuesto o gastos |

**Archivos relacionados:**
- `frontend/src/app/(app)/importar/page.tsx` — Pantalla de importacion
- `backend/app/api/v1/imports.py` — Endpoints de importacion
- `backend/app/services/import_service.py` — Procesamiento de archivos Excel

---

### 7. Gestion de usuarios

Administracion de usuarios del sistema (solo accesible para el tesorero).

**Archivos relacionados:**
- `backend/app/api/v1/users.py` — Endpoints de usuarios (crear, listar, editar)
- `backend/app/services/user_service.py` — Logica de usuarios

*Nota: Este modulo funciona por API pero aun no tiene pantalla en el frontend.*

---

### 8. Compañias

Listado de las compañias del CBT. Precargadas con datos reales (10 compañias).

**Archivos relacionados:**
- `backend/app/api/v1/companies.py` — Endpoint de listado
- `backend/app/models/company.py` — Modelo de datos

*Nota: Solo disponible por API, sin pantalla propia.*

---

## Navegacion del sistema

La aplicacion tiene un menu lateral (sidebar) con los siguientes enlaces:

1. **Dashboard** (`/dashboard`) — Panel principal
2. **Presupuesto** (`/presupuesto`) — Control presupuestario
3. **Gastos** (`/gastos`) — Gestion de gastos
4. **Importar** (`/importar`) — Importacion Excel
5. **Alertas** (`/alertas`) — Centro de notificaciones

**Archivos de navegacion:**
- `frontend/src/components/layout/sidebar.tsx` — Menu lateral
- `frontend/src/components/layout/header.tsx` — Barra superior con icono de alertas

---

## Datos precargados (Seeds)

Al ejecutar los seeds, el sistema se carga con datos reales del CBT para el año 2026:

- **10 compañias** (Primera a Novena + Undecima)
- **45 partidas presupuestarias** con montos reales
- **Presupuesto total:** $961.094.892 CLP
- **1 usuario administrador** (tesorero)
- **Configuracion:** IMM = $500.000, limite superintendente = 5 IMM

**Archivo:** `backend/seeds/run_seeds.py`

---

## Como levantar el sistema

```
docker-compose up --build
```

Esto inicia 3 servicios:

| Servicio | Puerto | Descripcion |
|----------|--------|-------------|
| Base de datos | 5432 | PostgreSQL 16 |
| Backend | 8000 | API del sistema |
| Frontend | 3000 | Interfaz web |

Despues de levantar, cargar los datos iniciales:

```
docker-compose exec backend python -m seeds.run_seeds
```

Abrir `http://localhost:3000` en el navegador.

---

## Modulos pendientes (futuras fases)

- Pantalla de administracion de usuarios en el frontend
- Exportacion a Excel
- Flujo de aprobacion multi-paso
- Conciliacion bancaria
- Rendiciones
- Cierre contable por compañia
- Subida de documentos de respaldo
- Modulos de IA y automatizacion
