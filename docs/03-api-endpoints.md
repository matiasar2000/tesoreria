# API Endpoints — ERP Tesorería CBT

Base URL: `/api/v1`

## 1. Autenticación

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `POST` | `/auth/login` | Login con email + password → access + refresh token | Público |
| `POST` | `/auth/refresh` | Renovar access token con refresh token | Autenticado |
| `POST` | `/auth/logout` | Invalidar refresh token | Autenticado |
| `GET` | `/auth/me` | Obtener perfil del usuario autenticado | Autenticado |
| `PUT` | `/auth/change-password` | Cambiar contraseña | Autenticado |

## 2. Usuarios

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/users` | Listar usuarios | tesorero |
| `POST` | `/users` | Crear usuario | tesorero |
| `GET` | `/users/{id}` | Detalle de usuario | tesorero |
| `PUT` | `/users/{id}` | Actualizar usuario | tesorero |
| `PATCH` | `/users/{id}/deactivate` | Desactivar usuario | tesorero |

## 3. Años Fiscales

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/fiscal-years` | Listar años fiscales | Autenticado |
| `POST` | `/fiscal-years` | Crear año fiscal | tesorero |
| `GET` | `/fiscal-years/{id}` | Detalle con resumen de ejecución | Autenticado |
| `PUT` | `/fiscal-years/{id}` | Actualizar (estado, notas) | tesorero |
| `GET` | `/fiscal-years/{id}/summary` | Resumen ejecutivo del año fiscal | Autenticado |

## 4. Partidas Presupuestarias

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/fiscal-years/{fy_id}/budget-items` | Listar partidas con ejecución y semáforo | Autenticado |
| `GET` | `/fiscal-years/{fy_id}/budget-items/{id}` | Detalle de partida con historial de gastos | Autenticado |
| `PUT` | `/fiscal-years/{fy_id}/budget-items/{id}` | Actualizar monto asignado / umbrales | tesorero |
| `PATCH` | `/fiscal-years/{fy_id}/budget-items/{id}/block` | Bloquear/desbloquear partida | tesorero |
| `GET` | `/fiscal-years/{fy_id}/budget-items/execution` | Reporte de ejecución presupuestaria completo | Autenticado |

**Response de listado incluye campos calculados:**
```json
{
  "id": "uuid",
  "number": 6,
  "name": "Combustibles y lubricantes",
  "authority": "comandancia",
  "allocated_amount": 48000000,
  "executed_amount": 10080000,
  "available_amount": 37920000,
  "execution_percentage": 21.0,
  "status_color": "green",
  "is_blocked": false
}
```

## 5. Gastos

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/expenses` | Listar gastos paginados (filtros: año fiscal, partida, estado) | Autenticado |
| `POST` | `/expenses` | Registrar nuevo gasto; opcionalmente crear bien de inventario asociado | tesorero, equipo_tesoreria |
| `GET` | `/expenses/{id}` | Detalle de gasto con documentos, flujo de aprobación e inventario asociado | Autenticado |
| `PUT` | `/expenses/{id}` | Actualizar gasto (solo si está en draft) | tesorero, equipo_tesoreria |
| `DELETE` | `/expenses/{id}` | Eliminar gasto; revierte presupuesto si estaba aprobado y da de baja bienes asociados | tesorero |
| `PATCH` | `/expenses/{id}/advance` | Aprobar el paso pendiente del flujo | Rol requerido por el paso |
| `PATCH` | `/expenses/{id}/approve` | Alias de avance/aprobación del paso pendiente | Rol requerido por el paso |
| `PATCH` | `/expenses/{id}/reject` | Rechazar gasto pendiente y dar de baja bienes asociados | Rol requerido por el paso |
| `PATCH` | `/expenses/{id}/void` | Anular gasto; revierte presupuesto si estaba aprobado y da de baja bienes asociados | tesorero |

### Reglas de negocio al crear/aprobar gastos:

1. Si `amount > allocated_amount - executed_amount` de la partida → **error 400** (fondos insuficientes)
2. Si la partida está bloqueada → **error 400**
3. Si `amount > 1.000.000` → `requires_quotations = true`, debe tener 3 documentos tipo `quotation`
4. Si `authorized_by_superintendent = true` y `amount > IMM * 5` → **alerta automática** a directorio
5. Al aprobar → `budget_items.executed_amount += expense.amount`
6. Si `create_inventory_asset = true`, se debe enviar `inventory_asset`; el backend crea un bien asociado al gasto.
7. Al rechazar, anular o eliminar un gasto con bienes asociados, esos bienes quedan inactivos y con condición `baja`.

**Payload opcional para crear inventario desde un gasto:**
```json
{
  "budget_item_id": "uuid",
  "amount": 1780000,
  "description": "Adquisicion mangueras forestales",
  "expense_date": "2026-02-20",
  "create_inventory_asset": true,
  "inventory_asset": {
    "name": "Mangueras forestales 45mm",
    "category": "material_operativo",
    "serial_number": "MNG-FOR-045",
    "current_condition": "bueno",
    "location": "Bodega Sexta Compania"
  }
}
```

La respuesta de gastos incluye `inventory_assets` con los bienes vinculados.

## 6. Documentos de Respaldo

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/expenses/{expense_id}/documents` | Listar documentos de un gasto | Autenticado |
| `POST` | `/expenses/{expense_id}/documents` | Subir documento (multipart/form-data) | tesorero, equipo_tesoreria |
| `DELETE` | `/documents/{id}` | Eliminar documento | tesorero |
| `PATCH` | `/documents/{id}/verify` | Marcar como verificado | tesorero |

## 7. Flujo de Aprobación

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/expenses/{expense_id}/approval-flow` | Ver flujo de aprobación del gasto | Autenticado |
| `GET` | `/approvals/pending` | Gastos pendientes de mi aprobación | tesorero, superintendente |

## 8. Cuentas Bancarias

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/bank-accounts` | Listar cuentas con saldos | tesorero, equipo_tesoreria |
| `GET` | `/bank-accounts/{id}` | Detalle de cuenta | tesorero, equipo_tesoreria |
| `PUT` | `/bank-accounts/{id}` | Actualizar saldo | tesorero |
| `GET` | `/bank-accounts/{id}/transactions` | Movimientos de la cuenta (paginados, filtros por fecha) | tesorero, equipo_tesoreria |
| `POST` | `/bank-accounts/{id}/transactions` | Registrar movimiento manual | tesorero |
| `POST` | `/bank-accounts/{id}/import` | Importar movimientos desde Excel | tesorero |
| `POST` | `/bank-accounts/{id}/reconcile` | Ejecutar conciliación automática | tesorero |
| `GET` | `/bank-accounts/{id}/reconciliation-report` | Reporte de conciliación | tesorero |

## 9. Compañías

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/companies` | Listar compañías | Autenticado |
| `GET` | `/companies/{id}` | Detalle de compañía | Autenticado |

## 10. Cierre Contable por Compañía

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/fiscal-years/{fy_id}/closings` | Tablero de cierre: estado de todas las compañías | tesorero, equipo_tesoreria |
| `GET` | `/fiscal-years/{fy_id}/closings/{company_id}` | Estado de cierre de una compañía | tesorero, equipo_tesoreria, director_compania (propia) |
| `PUT` | `/fiscal-years/{fy_id}/closings/{company_id}` | Actualizar estado de documentos entregados | tesorero, equipo_tesoreria |
| `PATCH` | `/fiscal-years/{fy_id}/closings/{company_id}/verify` | Marcar cierre como verificado | tesorero |
| `POST` | `/fiscal-years/{fy_id}/closings/send-reminders` | Enviar recordatorios a compañías pendientes | tesorero |

## 11. Deudas y Acreencias

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/debts` | Listar deudas/acreencias (filtros: tipo, estado, vencimiento) | tesorero, equipo_tesoreria |
| `POST` | `/debts` | Registrar deuda o acreencia | tesorero |
| `GET` | `/debts/{id}` | Detalle | tesorero, equipo_tesoreria |
| `PUT` | `/debts/{id}` | Actualizar | tesorero |
| `POST` | `/debts/{id}/payment` | Registrar pago parcial o total | tesorero |
| `GET` | `/debts/summary` | Resumen: total por pagar, total por cobrar, vencidas | tesorero, superintendente, directorio |

## 12. Rendiciones

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/renditions` | Listar rendiciones | tesorero, equipo_tesoreria |
| `POST` | `/renditions` | Crear rendición (seleccionar período) | tesorero |
| `GET` | `/renditions/{id}` | Detalle con gastos incluidos | tesorero, equipo_tesoreria |
| `POST` | `/renditions/{id}/generate` | Generar rendición automática (recopilar gastos, verificar respaldos) | tesorero |
| `GET` | `/renditions/{id}/missing-documents` | Gastos con respaldos faltantes | tesorero, equipo_tesoreria |
| `POST` | `/renditions/{id}/submit` | Marcar como presentada | tesorero |
| `GET` | `/renditions/{id}/export` | Exportar rendición en formato SIRC | tesorero |

## 12.1 Inventario de Bienes

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/assets` | Listar bienes activos (filtros: categoria, compañia, condicion) | Autenticado |
| `GET` | `/assets/summary` | Resumen de inventario: total, valor, activos, bajas y categorias | Autenticado |
| `POST` | `/assets` | Crear bien; puede asociarse a `acquisition_expense_id` | tesorero |
| `GET` | `/assets/{id}` | Detalle de un bien | Autenticado |
| `PUT` | `/assets/{id}` | Actualizar bien, incluida su asociacion opcional a gasto | tesorero |

**Campos de relacion con gastos:**
- `acquisition_expense_id`: gasto de adquisicion asociado. Es opcional.
- `acquisition_expense_description`: descripcion del gasto asociado en la respuesta.
- `acquisition_expense_status`: estado actual del gasto asociado en la respuesta.

Si se informa `acquisition_expense_id`, el backend valida que el gasto exista.

## 13. Alertas y Notificaciones

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/alerts` | Mis alertas (filtros: tipo, severity, leídas/no leídas) | Autenticado |
| `GET` | `/alerts/unread-count` | Cantidad de alertas no leídas | Autenticado |
| `PATCH` | `/alerts/{id}/read` | Marcar como leída | Autenticado |
| `PATCH` | `/alerts/read-all` | Marcar todas como leídas | Autenticado |

## 14. Dashboard

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/dashboard/summary` | Resumen general: presupuesto, saldos, alertas críticas | Autenticado (filtrado por rol) |
| `GET` | `/dashboard/budget-execution` | Ejecución presupuestaria con semáforo (gráfico) | Autenticado |
| `GET` | `/dashboard/bank-balances` | Saldos de las 3 cuentas | tesorero, equipo_tesoreria |
| `GET` | `/dashboard/monthly-expenses` | Gastos mensuales del año (gráfico de líneas) | Autenticado |
| `GET` | `/dashboard/closing-status` | Estado de cierre por compañía | tesorero, equipo_tesoreria |
| `GET` | `/dashboard/pending-approvals` | Gastos pendientes de aprobación | tesorero, superintendente |
| `GET` | `/dashboard/upcoming-deadlines` | Plazos próximos (rendiciones, cierres, vencimientos) | tesorero, equipo_tesoreria |
| `GET` | `/dashboard/superintendent` | Dashboard ejecutivo para Superintendente | superintendente |
| `GET` | `/dashboard/company/{id}` | Dashboard de una compañía | director_compania (propia), tesorero |

## 15. Importación/Exportación

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `POST` | `/import/budget` | Importar presupuesto desde Excel | tesorero |
| `POST` | `/import/expenses` | Importar gastos desde Excel | tesorero |
| `POST` | `/import/bank-transactions` | Importar cartolas bancarias desde Excel | tesorero |
| `GET` | `/export/budget-execution` | Exportar ejecución presupuestaria a Excel | tesorero, equipo_tesoreria |
| `GET` | `/export/expenses` | Exportar gastos a Excel (con filtros) | tesorero, equipo_tesoreria |
| `GET` | `/export/reconciliation/{account_id}` | Exportar conciliación bancaria | tesorero |

## 16. Auditoría

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/audit-log` | Registro de auditoría (filtros: usuario, acción, entidad, fecha) | tesorero |
| `GET` | `/audit-log/entity/{type}/{id}` | Historial de cambios de una entidad específica | tesorero |

## 17. Configuración del Sistema

| Método | Ruta | Descripción | Roles |
|---|---|---|---|
| `GET` | `/config` | Obtener configuración actual | tesorero |
| `PUT` | `/config/{key}` | Actualizar valor de configuración | tesorero |

---

## Convenciones Generales

### Paginación
```
GET /expenses?page=1&page_size=20
```
```json
{
  "items": [...],
  "total": 150,
  "page": 1,
  "page_size": 20,
  "pages": 8
}
```

### Filtros
Los filtros se pasan como query parameters:
```
GET /expenses?status=approved&budget_item_id=uuid&fiscal_year_id=uuid
```

### Ordenamiento
El listado de gastos se entrega ordenado por `expense_date` descendente desde backend. Cuando otro endpoint soporte ordenamiento explicito, se usa este formato:
```
GET /endpoint?sort_by=created_at&sort_order=desc
```

### Errores
```json
{
  "detail": "Fondos insuficientes en la partida 'Combustibles y lubricantes'. Disponible: $37.920.000, solicitado: $40.000.000",
  "code": "INSUFFICIENT_BUDGET",
  "status_code": 400
}
```

### Códigos de Error de Negocio

| Código | Descripción |
|---|---|
| `INSUFFICIENT_BUDGET` | Monto excede el saldo disponible de la partida |
| `BUDGET_ITEM_BLOCKED` | Partida bloqueada para nuevos gastos |
| `SUPERINTENDENT_LIMIT_EXCEEDED` | Gasto supera el límite de 5 IMM del Superintendente |
| `MISSING_QUOTATIONS` | Gasto > $1.000.000 sin 3 cotizaciones |
| `MISSING_RECEPTION_ACT` | Falta Acta de Recepción Conforme |
| `APPROVAL_REQUIRED` | Gasto requiere aprobación del Directorio |
| `BUDGET_NOT_APPROVED` | Presupuesto del año fiscal no aprobado |
| `RENDITION_INCOMPLETE` | Rendición tiene gastos sin respaldo completo |
| `CLOSING_NOT_COMPLETE` | Cierre contable tiene documentos pendientes |
