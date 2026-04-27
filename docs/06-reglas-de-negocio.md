# Reglas de Negocio — ERP Tesorería CBT

Este documento describe las reglas de negocio que el sistema debe implementar, derivadas del Reglamento General del CBT, los Estatutos, la Circular N°9 de 2026 y las prácticas operativas de la Tesorería.

## 1. Presupuesto y Ejecución

### RN-001: Semáforo presupuestario
- **Verde:** ejecución < umbral amarillo (default 80%)
- **Amarillo:** ejecución >= umbral amarillo y < umbral rojo (default 100%)
- **Rojo:** ejecución >= umbral rojo
- Los umbrales son configurables por partida

### RN-002: Bloqueo de partida agotada
- Cuando una partida alcanza el 100% de ejecución, se bloquea automáticamente
- No se pueden registrar nuevos gastos contra una partida bloqueada
- Solo el Tesorero puede desbloquear manualmente (requiere justificación registrada en auditoría)

### RN-003: Descuento automático
- Al aprobar un gasto, su monto se suma al `executed_amount` de la partida correspondiente
- Al rechazar o eliminar un gasto aprobado, el monto se revierte
- El `available_amount` se recalcula siempre como `allocated_amount - executed_amount`

### RN-004: Presupuesto no aprobado
- Si el año fiscal tiene `status != approved`, el sistema muestra un banner de advertencia permanente
- Los gastos se pueden registrar pero se marca que fueron ejecutados sin presupuesto aprobado

## 2. Gastos y Aprobaciones

### RN-005: Límite del Superintendente (Art. 41 letra f, Reglamento)
- El Superintendente puede autorizar gastos de emergencia hasta **5 IMM** (Ingresos Mínimos Mensuales)
- El valor del IMM se toma de `system_config` y se actualiza manualmente
- Si un gasto marcado como `authorized_by_superintendent = true` supera 5 × IMM:
  - Se genera alerta tipo `superintendent_limit` con severidad `critical`
  - La alerta se envía a todos los usuarios con rol `directorio`
  - El gasto queda registrado pero flaggeado

### RN-006: Cotizaciones obligatorias (Circular N°9, Anexo N°10)
- Gastos > $1.000.000 CLP requieren **3 cotizaciones**
- Al registrar un gasto con `amount > 1_000_000`, el campo `requires_quotations` se establece en `true`
- El gasto no puede pasar a estado `approved` si no tiene al menos 3 documentos tipo `quotation`
- Excepción: gastos con categoría de proveedor especial (Anexo N°10, Punto 2), que requieren Acta de Directorio + Informe fundado

### RN-007: Acta de Recepción Conforme (Circular N°9, Anexos N°3 y N°8)
- Todo gasto de operaciones e inversiones (excepto servicios básicos de consumo) requiere Acta de Recepción Conforme
- Servicios básicos exentos: electricidad (ítem 9), teléfono (ítem 10), gas (ítem 11), agua (ítem 12)
- El gasto no puede incluirse en una rendición si `has_reception_act = false` y no está exento

### RN-008: Informe previo de Comisión de Rentas (Art. 17, Reglamento)
- El Reglamento prohíbe aprobar gastos sin informe previo de la Comisión de Rentas
- El sistema registra si el gasto tiene informe de la Comisión como campo booleano
- Para gastos significativos (umbral configurable), el flujo de aprobación requiere este paso

### RN-009: Flujo de aprobación según monto
- **Hasta $500.000:** aprobación del equipo de Tesorería
- **$500.001 - 5 IMM:** aprobación del Tesorero
- **Mayor a 5 IMM:** aprobación del Tesorero + Superintendente + HDG
- Los montos de los tramos son configurables en `system_config`

### RN-010: Fondos insuficientes
- No se puede aprobar un gasto si `expense.amount > budget_item.available_amount`
- Error: `INSUFFICIENT_BUDGET`

### RN-010A: Relacion opcional entre gastos e inventario
- Un gasto puede registrar un bien inventariable al momento de crearse mediante `create_inventory_asset = true`.
- La relacion no es obligatoria: gastos de servicios, consumo, honorarios, mantenciones u otros egresos pueden no generar bienes.
- Un bien de inventario tambien puede existir sin gasto asociado, por ejemplo por donacion, alta historica, traspaso, regularizacion o carga inicial.
- El vinculo se guarda en `assets.acquisition_expense_id`; la respuesta del gasto expone `inventory_assets`.

### RN-010B: Creacion de bien desde gasto
- Si `create_inventory_asset = true`, el payload debe incluir `inventory_asset`.
- El bien hereda desde el gasto: `company_id`, `acquisition_date`, `acquisition_value` y `acquisition_expense_id`.
- El backend valida categoria y condicion del bien antes de guardar.
- Crear el bien no aprueba el gasto ni ejecuta presupuesto por si mismo; el presupuesto se afecta cuando el gasto queda `approved`.

### RN-010C: Efecto de acciones de gasto sobre inventario
- Rechazar un gasto pendiente marca sus bienes asociados como inactivos y condicion `baja`.
- Anular un gasto marca sus bienes asociados como inactivos y condicion `baja`; si el gasto estaba aprobado, tambien revierte el monto ejecutado del presupuesto.
- Eliminar un gasto marca sus bienes asociados como inactivos y condicion `baja`; si estaba aprobado, tambien revierte el presupuesto.
- Los bienes no se borran automaticamente, para conservar trazabilidad patrimonial.

## 3. Cuentas Bancarias y Conciliación

### RN-011: Conciliación bancaria
- El sistema cruza `bank_transactions` con `expenses` comparando: monto (exacto o con tolerancia configurable), fecha (rango de ±3 días) y referencia
- Los movimientos que coinciden se marcan como `reconciled = true`
- Los movimientos sin coincidencia se listan para revisión manual
- La conciliación no modifica datos, solo marca relaciones

### RN-012: Saldo bancario
- El `current_balance` de `bank_accounts` se actualiza con cada transacción importada o registrada
- El saldo consolidado (suma de las 3 cuentas) se muestra en el dashboard

## 4. Cierre Contable por Compañía

### RN-013: Documentos requeridos para cierre
Cada compañía debe entregar 5 tipos de documentos:
1. Egresos
2. Traspasos
3. Ingresos con respaldo
4. Cartolas bancarias
5. Conciliaciones bancarias

El cierre se considera `complete` cuando los 5 campos booleanos son `true`.

### RN-014: Recordatorios automáticos
- A 30, 15 y 5 días del `due_date`, se envían alertas al `director_user_id` de la compañía
- Las compañías con `status = pending` a 5 días del vencimiento generan alerta `critical` al Tesorero

## 5. Rendiciones

### RN-015: Plazo de rendición (Circular N°9, Punto VIII, numeral 3)
- Fondos deben estar gastados al **31 de diciembre**
- Rendición debe presentarse en los **primeros 15 días hábiles de enero**
- Si no se rinde en plazo: **reintegro obligatorio**, sin posibilidad de regularización
- El sistema genera alertas a 60, 30, 15 y 5 días del vencimiento

### RN-016: Completitud de rendición
- Una rendición solo puede pasar a estado `ready` si `missing_documents_count = 0`
- Si hay gastos con respaldos faltantes, se listan para regularización

### RN-017: Documentos adjuntos en Manager+ (Circular N°9)
- Desde 03/03/2026, los documentos de egresos y traspasos en Manager+ deben adjuntarse firmados
- El sistema registra esta exigencia como referencia informativa

## 6. Deudas y Acreencias

### RN-018: Estado de deudas
- `pending`: deuda registrada, sin pagos
- `partial`: tiene pagos parciales (`paid_amount > 0` y `paid_amount < total_amount`)
- `paid`: `paid_amount >= total_amount`
- `overdue`: `due_date < today` y `status != paid`

### RN-019: Deudas con fondos públicos
- Si `funded_by_public_funds = true`, la deuda se destaca en el dashboard
- Afecta la proyección de flujo de caja (los fondos comprometidos no están disponibles)

## 7. Alertas

### RN-020: Tipos de alerta y severidad

| Tipo | Condición | Severidad |
|---|---|---|
| `budget_yellow` | Partida alcanza umbral amarillo | `warning` |
| `budget_red` | Partida alcanza umbral rojo | `critical` |
| `budget_blocked` | Partida bloqueada automáticamente | `critical` |
| `superintendent_limit` | Gasto supera 5 IMM | `critical` |
| `deadline` | Plazo de rendición próximo | `warning` → `critical` (< 5 días) |
| `reconciliation` | Diferencias en conciliación | `warning` |
| `closing_reminder` | Compañía no ha entregado documentos | `info` → `warning` → `critical` |

### RN-021: Destinatarios de alertas
- Alertas presupuestarias → Tesorero + equipo de Tesorería
- Alertas de límite del Superintendente → Directorio
- Alertas de cierre → Director de compañía afectada + Tesorero
- Alertas de plazos → Tesorero + equipo de Tesorería

## 8. Auditoría

### RN-022: Registro obligatorio
Todas las siguientes acciones generan entrada en `audit_log`:
- Crear, modificar o eliminar gastos
- Aprobar o rechazar gastos
- Bloquear o desbloquear partidas
- Modificar montos presupuestarios
- Importar datos (Excel)
- Registrar pagos de deudas
- Generar o presentar rendiciones
- Cambios en configuración del sistema
- Login y logout

### RN-023: Inmutabilidad del log
- Los registros de auditoría no se pueden modificar ni eliminar
- Solo el rol `tesorero` puede consultar el log completo
- El log incluye `old_values` y `new_values` para trazar cambios

## 9. Importación de Datos

### RN-024: Importación Excel
- El sistema acepta archivos `.xlsx` y `.csv`
- Se valida estructura de columnas antes de procesar
- Filas con errores se rechazan individualmente (no abortan la importación completa)
- Se genera reporte de importación: filas procesadas, filas con error, detalle de errores
- Toda importación queda registrada en auditoría

### RN-025: Formato de montos
- Los montos importados se normalizan: se eliminan puntos de miles, se acepta `$` como prefijo
- Valores negativos se interpretan según contexto (egresos en cartolas bancarias)

## 10. Formato y Localización

### RN-026: Moneda y formato
- Moneda: Peso chileno (CLP)
- Formato visualización: `$961.094.892` (punto como separador de miles, sin decimales)
- Almacenamiento interno: `NUMERIC(15,2)` sin formato
- Zona horaria: `America/Santiago`
- Formato de fecha: `dd/MM/yyyy` en frontend, `ISO 8601` en API

### RN-027: Idioma
- Interfaz completa en español (Chile)
- Mensajes de error en español
- Documentación API en español
