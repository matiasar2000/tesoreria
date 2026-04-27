# Pantallas del Frontend — ERP Tesorería CBT

## 1. Mapa de Navegación

```
Login
│
└── App (sidebar + header)
    ├── Dashboard (/dashboard)
    ├── Presupuesto (/presupuesto)
    │   └── Detalle partida (/presupuesto/[id])
    ├── Gastos (/gastos)
    │   ├── Nuevo gasto (/gastos/nuevo)
    │   └── Detalle gasto (/gastos/[id])
    ├── Aprobaciones (/aprobaciones)
    ├── Bancos (/bancos)
    │   ├── Movimientos (/bancos/[id])
    │   └── Importar cartola (/bancos/importar)
    ├── Compañías (/companias)
    │   └── Cierre compañía (/companias/[id])
    ├── Deudas (/deudas)
    ├── Inventario (/inventario)
    ├── Rendiciones (/rendiciones)
    │   └── Detalle rendición (/rendiciones/[id])
    ├── Alertas (/alertas)
    ├── Importar datos (/importar)
    ├── Auditoría (/auditoria)
    └── Configuración (/configuracion)
        └── Usuarios (/configuracion/usuarios)
```

## 2. Acceso por Rol

| Pantalla | Tesorero | Superintendente | Equipo | Director Cía. | Directorio |
|---|---|---|---|---|---|
| Dashboard | Completo | Ejecutivo | Completo | Su compañía | Ejecutivo |
| Presupuesto | CRUD | Solo lectura | Solo lectura | Solo lectura | Solo lectura |
| Gastos | CRUD | Aprobar | CRUD | Solo lectura (su cía) | — |
| Aprobaciones | Sí | Sí | — | — | — |
| Bancos | CRUD + Import | — | Solo lectura | — | — |
| Compañías (cierre) | Gestionar | — | Gestionar | Su compañía | — |
| Deudas | CRUD | Solo lectura | Solo lectura | — | Resumen |
| Inventario | CRUD | Solo lectura | Solo lectura | Solo lectura (su cía) | Solo lectura |
| Rendiciones | CRUD | — | Solo lectura | — | — |
| Alertas | Todas | Las suyas | Las suyas | Las suyas | Las suyas |
| Importar | Sí | — | — | — | — |
| Auditoría | Sí | — | — | — | — |
| Configuración | Sí | — | — | — | — |

## 3. Descripción de Pantallas Clave

### 3.1 Login (`/login`)
- Formulario: email + password
- Logo del CBT
- Sin registro público (usuarios los crea el Tesorero)

### 3.2 Dashboard (`/dashboard`)

Layout con cards y widgets:

```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Tesorería General CBT    [Alertas 🔔3] [User] │
├───────┬─────────────────────────────────────────────────┤
│       │                                                  │
│  S    │  ┌──────────┐ ┌──────────┐ ┌──────────┐        │
│  I    │  │Presupuesto│ │  Saldo   │ │ Gastos   │        │
│  D    │  │ Total     │ │ Bancario │ │ del Mes  │        │
│  E    │  │$961.094M  │ │$51.965M  │ │$45.230M  │        │
│  B    │  └──────────┘ └──────────┘ └──────────┘        │
│  A    │                                                  │
│  R    │  ┌─────────────────────────────────────┐        │
│       │  │  Ejecución Presupuestaria (barras)  │        │
│  D    │  │  ████████░░ 21% Combustibles        │        │
│  a    │  │  ██████████ 105% Indemnizaciones ⚠️ │        │
│  s    │  │  ██░░░░░░░░ 16% Remuneraciones      │        │
│  h    │  │  ...                                 │        │
│  b    │  └─────────────────────────────────────┘        │
│  o    │                                                  │
│  a    │  ┌────────────────┐ ┌──────────────────┐        │
│  r    │  │ Alertas         │ │ Cierre Compañías │        │
│  d    │  │ Recientes       │ │ 4/10 completas   │        │
│       │  │ ⚠️ Ítem 4 rojo  │ │ ██████████░░░░░  │        │
│  P    │  │ ⚠️ Plazo rend.  │ │                  │        │
│  r    │  └────────────────┘ └──────────────────┘        │
│  e    │                                                  │
│  s    │  ┌─────────────────────────────────────┐        │
│  u    │  │  Gastos Mensuales (gráfico líneas)  │        │
│  p    │  │  Ene  Feb  Mar  Abr  ...            │        │
│       │  └─────────────────────────────────────┘        │
│       │                                                  │
├───────┴─────────────────────────────────────────────────┤
│  © 2026 Tesorería General - Cuerpo de Bomberos Talcah.  │
└─────────────────────────────────────────────────────────┘
```

**Cards superiores:**
- Presupuesto total del año fiscal con % ejecutado
- Saldo bancario consolidado (suma de 3 cuentas)
- Gastos del mes actual
- Aprobaciones pendientes (solo para tesorero/superintendente)

**Widgets:**
- Ejecución presupuestaria: barras horizontales con semáforo por partida (top 10 más relevantes)
- Alertas recientes: últimas 5 alertas no leídas
- Cierre por compañía: indicador visual de progreso
- Gastos mensuales: gráfico de líneas comparando año actual vs anterior
- Saldos bancarios: 3 cuentas con barras

### 3.3 Presupuesto (`/presupuesto`)

Tabla de 45 partidas:

| Semáforo | N° | Ítem | Mando | Asignado | Ejecutado | Disponible | % Ejec. |
|---|---|---|---|---|---|---|---|
| 🟢 | 1 | Remuneraciones | Supt. | $358.891.392 | $56.017.875 | $302.873.517 | 16% |
| 🔴 | 4 | Indemnizaciones | Supt. | $5.000.000 | $5.250.000 | -$250.000 | 105% |
| 🟢 | 6 | Combustibles | Cmd. | $48.000.000 | $10.080.000 | $37.920.000 | 21% |

- Filtros: por mando (superintendencia/comandancia/mixto), por color de semáforo
- Ordenamiento por cualquier columna
- Click en fila → detalle de partida
- Barra de resumen: total asignado, total ejecutado, % global

### 3.4 Detalle de Partida (`/presupuesto/[id]`)
- Información de la partida (nombre, mando, montos, semáforo)
- Gráfico de ejecución mensual
- Tabla de gastos imputados a esta partida
- Comparación con mismo período del año anterior (cuando haya datos)
- Botón de bloquear/desbloquear (solo tesorero)

### 3.5 Gastos (`/gastos`)
- Tabla de gastos con filtros: estado, partida, fecha, proveedor, compañía, monto
- Columnas: fecha, descripción, proveedor, monto, partida, estado, inventario, respaldos (iconos)
- Badge de estado con color: draft (gris), pending_review/pending_approval/pending_directorio (amarillo), approved (verde), rejected (rojo), voided (gris)
- Indicador de respaldos: iconos para factura, acta, cotizaciones (check verde / X rojo)
- Indicador de inventario: muestra si el gasto tiene bienes asociados y cuántos son
- El detalle del gasto muestra la lista de bienes asociados con categoría, serie y condición
- Botón "Nuevo gasto"

### 3.6 Nuevo Gasto (`/gastos/nuevo`)
Formulario:
- Partida presupuestaria (select con saldo disponible visible)
- Monto (input numérico con formato CLP)
- Fecha del gasto (date picker)
- Descripción (textarea)
- Proveedor: RUT + nombre
- Número de factura
- Compañía asociada (opcional, select)
- Autorizado por Superintendente (checkbox, muestra alerta si > 5 IMM)
- Registrar bien inventariable asociado (checkbox)
- Datos del bien inventariable cuando aplica: nombre, categoria, condicion, numero de serie, ubicacion y notas
- Subida de documentos (drag & drop, múltiple)
- Validaciones en tiempo real:
  - Alerta si monto > saldo disponible
  - Alerta si monto > $1.000.000 (requiere cotizaciones)
  - Alerta si monto > 5 IMM y autorizado por Superintendente

### 3.7 Detalle de Gasto (`/gastos/[id]`)
- Información completa del gasto
- Timeline de aprobación (pasos completados y pendientes)
- Bienes de inventario asociados, si existen
- Lista de documentos adjuntos con preview y descarga
- Botones de acción según estado y rol: aprobar, rechazar, editar, eliminar

### 3.8 Aprobaciones (`/aprobaciones`)
- Lista de gastos pendientes de mi aprobación
- Resumen rápido de cada gasto (monto, partida, solicitante)
- Botones directos de aprobar/rechazar con modal de comentario
- Indicador de urgencia (tiempo esperando aprobación)

### 3.9 Bancos (`/bancos`)
- 3 cards con saldo de cada cuenta
- Card consolidada con saldo total
- Última fecha de conciliación por cuenta
- Click en cuenta → movimientos

### 3.10 Movimientos Bancarios (`/bancos/[id]`)
- Tabla de transacciones con filtros de fecha
- Columnas: fecha, descripción, referencia, monto (+/-), conciliado (sí/no)
- Indicador visual de transacciones no conciliadas
- Botón "Importar cartola" y "Ejecutar conciliación"
- Reporte de conciliación: movimientos conciliados, diferencias

### 3.11 Compañías - Cierre Contable (`/companias`)
Tablero visual tipo kanban o grid:

```
┌─────────────┐ ┌─────────────┐ ┌─────────────┐
│ 1ª Compañía │ │ 2ª Compañía │ │ 3ª Compañía │
│ ⬜⬜⬜⬜⬜  │ │ ⬜⬜⬜⬜⬜  │ │ ✅✅✅✅✅  │
│ PENDIENTE   │ │ PARCIAL     │ │ COMPLETA    │
└─────────────┘ └─────────────┘ └─────────────┘
```

Cada cuadrado = un tipo de documento (egresos, traspasos, ingresos, cartolas, conciliaciones).

### 3.12 Deudas (`/deudas`)
- Tabs: "Por pagar" / "Por cobrar"
- Tabla con: acreedor/deudor, monto total, monto pagado, saldo, vencimiento, estado
- Cards de resumen: total por pagar, total por cobrar, vencidas
- Botón de registrar pago parcial/total

### 3.12.1 Inventario (`/inventario`)
- Tabla de bienes con filtros por categoria y condicion
- Columnas: bien, categoria, compania, origen, adquisicion, condicion, ubicacion
- Resumen superior: total de bienes, valor total, activos y dados de baja
- Dialog de crear/editar bien con selector opcional de gasto de adquisicion
- Si el bien esta asociado a un gasto, la columna Origen muestra descripcion y estado del gasto

### 3.13 Rendiciones (`/rendiciones`)
- Lista de rendiciones con estado y plazo
- Countdown visual para plazos próximos
- Detalle: gastos incluidos, documentos faltantes, totales
- Botón "Generar rendición" y "Exportar SIRC"

### 3.14 Alertas (`/alertas`)
- Lista completa de alertas con filtros (tipo, severidad, leídas/no leídas)
- Marcar como leída individual o masiva
- Click navega a la entidad relacionada

## 4. Componentes Compartidos Clave

### `<TrafficLight color="green" />`
Indicador visual de semáforo (círculo verde/amarillo/rojo).

### `<MoneyDisplay amount={961094892} />`
Renderiza `$961.094.892` con formato CLP, color rojo si negativo.

### `<StatusBadge status="approved" />`
Badge con color según estado del gasto/rendición/deuda.

### `<DataTable />`
Tabla genérica con TanStack Table: paginación, ordenamiento, filtros, exportación.

### `<FileUpload />`
Drag & drop para subida de documentos, preview de archivos, validación de tipo y tamaño.

## 5. Responsive

- **Desktop (>1024px):** sidebar fija, layout completo
- **Tablet (768-1024px):** sidebar colapsable, tablas con scroll horizontal
- **Mobile (<768px):** sidebar como drawer, cards apiladas, tablas simplificadas
