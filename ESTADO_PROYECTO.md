# ERP Tesoreria CBT - Estado del Proyecto

Sistema de gestión de tesorería para el Cuerpo de Bomberos de Talcahuano (CBT).
Independiente de Manager+, enfocado en control presupuestario y registro de gastos.

---

## Estado actual

El proyecto se encuentra en **Fase 2** — con todos los modulos principales implementados y operativo en ambiente local con Docker.

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

### 9. Gestion de usuarios (frontend)

Pantalla para administrar usuarios del sistema desde la interfaz web.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Usuarios | `/usuarios` | Tabla de usuarios con crear, editar y activar/desactivar |

**Archivos relacionados:**
- `frontend/src/app/(app)/usuarios/page.tsx` — Pantalla de gestion de usuarios
- `backend/app/api/v1/users.py` — Endpoints de usuarios (ya existia)
- `backend/app/services/user_service.py` — Logica de usuarios (ya existia)

---

### 10. Exportacion a Excel

Descarga de reportes en formato Excel desde presupuesto y gastos.

**Archivos relacionados:**
- `backend/app/api/v1/exports.py` — Endpoints de exportacion (presupuesto y gastos)
- Botones integrados en `/presupuesto` y `/gastos`

---

### 11. Documentos de respaldo

Subida de archivos (boletas, facturas, PDF) asociados a cada gasto.

**Archivos relacionados:**
- `frontend/src/app/(app)/gastos/page.tsx` — Seccion de documentos integrada en gastos
- `backend/app/api/v1/documents.py` — Endpoints de documentos (upload, download, delete)
- `backend/app/services/document_service.py` — Logica de almacenamiento de archivos
- `backend/app/models/document.py` — Modelo de documento
- `backend/app/schemas/document.py` — Schema de documento

---

### 12. Flujo de aprobacion multi-paso

Cada gasto pasa por un flujo escalonado de aprobacion:

1. **Paso 1:** Revision por equipo de tesoreria
2. **Paso 2:** Aprobacion del tesorero
3. **Paso 3 (si monto > 5 IMM):** Aprobacion del directorio

El presupuesto se descuenta solo cuando se completan todos los pasos. Si se rechaza en cualquier paso, el gasto queda rechazado.

**Archivos relacionados:**
- `backend/app/models/approval_step.py` — Modelo de paso de aprobacion
- `backend/app/services/expense_service.py` — Logica de flujo multi-paso
- `backend/app/api/v1/expenses.py` — Endpoints de avance/rechazo
- `frontend/src/app/(app)/gastos/page.tsx` — Visualizacion del flujo con indicadores

---

### 13. Conciliacion bancaria

Modulo para registrar cuentas bancarias, movimientos y conciliar con gastos aprobados.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Banco | `/banco` | Cuentas bancarias, movimientos y conciliacion |

**Archivos relacionados:**
- `frontend/src/app/(app)/banco/page.tsx` — Pantalla de conciliacion
- `backend/app/api/v1/bank.py` — Endpoints de banco
- `backend/app/services/bank_service.py` — Logica de conciliacion
- `backend/app/models/bank_account.py` — Modelo de cuenta bancaria
- `backend/app/models/bank_transaction.py` — Modelo de movimiento bancario

---

### 14. Rendiciones

Generacion de rendiciones por compañia y periodo. Agrupa gastos aprobados y permite enviar/aprobar la rendicion.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Rendiciones | `/rendiciones` | Crear, enviar y aprobar rendiciones por compañia |

**Archivos relacionados:**
- `frontend/src/app/(app)/rendiciones/page.tsx` — Pantalla de rendiciones
- `backend/app/api/v1/renditions.py` — Endpoints de rendiciones
- `backend/app/services/rendition_service.py` — Logica de rendiciones
- `backend/app/models/rendition.py` — Modelos de rendicion y items

---

### 15. Cierre contable

Cierre del año fiscal: bloquea todas las partidas y previene nuevos gastos. Requiere que no haya gastos pendientes.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Cierre | `/cierre` | Resumen del año fiscal con opcion de cerrar/reabrir |

**Archivos relacionados:**
- `frontend/src/app/(app)/cierre/page.tsx` — Pantalla de cierre contable
- `backend/app/api/v1/fiscal_close.py` — Endpoints de cierre
- `backend/app/services/fiscal_close_service.py` — Logica de cierre y reapertura

---

### 16. Importacion de cartolas bancarias

Carga masiva de movimientos bancarios desde archivos CSV o Excel. Detecta automaticamente las columnas (fecha, descripcion/glosa, monto o cargo/abono, referencia). Soporta multiples formatos de fecha y encoding (UTF-8, Latin-1, CP1252). Actualiza el saldo de la cuenta automaticamente.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Banco | `/banco` | Boton "Importar Cartola" en la pestaña de movimientos |

**Archivos relacionados:**
- `frontend/src/app/(app)/banco/page.tsx` — Dialog de importacion integrado
- `backend/app/api/v1/bank.py` — Endpoint POST /bank/import-statement
- `backend/app/services/bank_service.py` — Logica de parsing CSV/Excel y creacion de transacciones

---

### 17. Reportes avanzados y balances formales

Pagina dedicada con graficos interactivos y balances financieros formales segun reglamento CBT:

**Graficos interactivos:**
- Tendencia mensual de gastos (grafico de linea)
- Ejecucion presupuestaria por partida (barras horizontales con semaforo)
- Distribucion de gastos por compañia (grafico de torta)
- Presupuesto asignado vs ejecutado (barras agrupadas)
- Top 10 proveedores por monto
- Desglose de gastos por estado

**Balances formales (Art. 55 Reglamento CBT):**
- Balance trimestral con desglose por partida (Art. 55-d)
- Balance anual completo con saldos bancarios (Art. 55-g)
- Rendicion documentada exportable a Excel (Art. 55-f)

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Reportes | `/reportes` | Graficos, balance trimestral, balance anual con export Excel |

**Archivos relacionados:**
- `frontend/src/app/(app)/reportes/page.tsx` — Pagina con graficos + tabs balance trimestral/anual
- `backend/app/api/v1/reports.py` — Endpoints summary, quarterly, annual, annual/export
- `backend/app/services/report_service.py` — Logica de agregacion, trimestres y balance anual
- `backend/app/schemas/reports.py` — Schemas incluyendo QuarterlyBalance, AnnualBalance

---

### 18. Inventario de bienes institucionales

Libro de Inventario General del CBT (Art. 27-28). Registro de todos los bienes: vehiculos, herramientas, uniformes, equipamiento, inmuebles, mobiliario y material operativo. Custodiado por la Tesoreria General.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Inventario | `/inventario` | CRUD de bienes con filtros por categoria y condicion |

**Archivos relacionados:**
- `frontend/src/app/(app)/inventario/page.tsx` — Tabla de bienes con filtros, crear/editar, resumen
- `backend/app/api/v1/assets.py` — Endpoints CRUD + summary
- `backend/app/services/asset_service.py` — Logica de bienes
- `backend/app/models/asset.py` — Modelo de bien institucional
- `backend/app/schemas/asset.py` — Schemas de bien

---

### 19. Control de ingresos

Registro de ingresos por fuente (Art. 35): subvenciones fiscales/municipales, donaciones, cuotas, rifas, aportes de compañias.

| Pantalla | Direccion web | Que hace |
|----------|---------------|----------|
| Ingresos | `/ingresos` | Tabla de ingresos con filtros, registro y grafico por fuente |

**Archivos relacionados:**
- `frontend/src/app/(app)/ingresos/page.tsx` — Pagina con tabla, filtros, dialog y grafico
- `backend/app/api/v1/incomes.py` — Endpoints CRUD + summary
- `backend/app/services/income_service.py` — Logica de ingresos
- `backend/app/models/income.py` — Modelo de ingreso
- `backend/app/schemas/income.py` — Schemas de ingreso

---

### 20. Restriccion de uso de fondos

Clasificacion de fuentes de financiamiento en partidas presupuestarias (Art. 30). Los fondos fiscales y municipales muestran advertencia al registrar gastos para documentar la justificacion.

**Archivos relacionados:**
- `backend/app/models/budget_item.py` — Campo fund_source agregado
- `backend/app/services/fund_validation.py` — Logica de validacion de fondos restringidos
- `backend/app/services/expense_service.py` — Validacion integrada al crear gastos
- `frontend/src/app/(app)/presupuesto/page.tsx` — Badges de fuente por color
- `frontend/src/app/(app)/gastos/nuevo/page.tsx` — Aviso para fondos restringidos

---

## Navegacion del sistema actualizada

1. **Dashboard** (`/dashboard`) — Panel principal
2. **Presupuesto** (`/presupuesto`) — Control presupuestario con fuente de fondos
3. **Gastos** (`/gastos`) — Gestion de gastos con flujo multi-paso y documentos
4. **Ingresos** (`/ingresos`) — Registro de ingresos por fuente
5. **Inventario** (`/inventario`) — Libro de Inventario General de bienes
6. **Alertas** (`/alertas`) — Centro de notificaciones
7. **Importar** (`/importar`) — Importacion Excel
8. **Reportes** (`/reportes`) — Reportes, balances trimestrales/anuales, export Excel
9. **Banco** (`/banco`) — Conciliacion bancaria con importacion de cartolas
10. **Rendiciones** (`/rendiciones`) — Rendiciones por compañia
11. **Cierre** (`/cierre`) — Cierre contable del año fiscal
12. **Usuarios** (`/usuarios`) — Administracion de usuarios

---

## Modulos pendientes (futuras fases)

- Modulos de IA y automatizacion
- Notificaciones por email
