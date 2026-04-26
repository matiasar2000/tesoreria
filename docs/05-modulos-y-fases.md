# Módulos y Fases de Desarrollo — ERP Tesorería CBT

## 1. Mapeo Módulos → Implementación Técnica

Cada módulo del catálogo original se implementa como combinación de endpoints API, servicios de backend y páginas de frontend.

### Parte A: Automatización

| Módulo | Componentes Backend | Páginas Frontend | Fase |
|---|---|---|---|
| **A1.** Control ejecución presupuestaria | `budget_service`, `budget_items` API, semáforo en `budget_item` schema | `/presupuesto`, dashboard widget | **1** |
| **A2.** Alerta límite Superintendente | `expense_service` (validación IMM), `alert_service` | Alerta en `/gastos`, notificación | **1** |
| **A3.** Conciliación bancaria | `bank_service.reconcile()`, `bank_transactions` API | `/bancos/{id}`, reporte conciliación | **2** |
| **A4.** Generación automática rendiciones | `rendition_service.generate()`, `renditions` API | `/rendiciones`, exportación SIRC | **3** |
| **A5.** Verificación respaldos documentales | `expense_service` (validación docs), `documents` API | Indicadores en `/gastos/{id}` | **2** |
| **A6.** Control plazos rendición | `alert_service` (tareas Celery), `renditions` API | Widget en dashboard, `/rendiciones` | **3** |
| **A7.** Seguimiento cierre por compañía | `closing_service`, `closings` API | `/companias` (tablero visual) | **2** |
| **A8.** Dashboard financiero | `dashboard_service`, `dashboard` API | `/dashboard` (panel principal) | **1** |
| **A9.** Flujo aprobación de gastos | `approval_service`, `approvals` API | `/aprobaciones`, flujo en `/gastos/{id}` | **2** |
| **A10.** Registro deudas y acreencias | `debt_service`, `debts` API | `/deudas` | **2** |

### Parte B: Inteligencia Artificial (Fase 4+)

| Módulo | Tecnología | Dependencia |
|---|---|---|
| **B1.** Lectura inteligente de documentos | Claude API (vision) + OCR | A5 implementado |
| **B2.** Detección de anomalías | Claude API + análisis estadístico | Datos históricos suficientes |
| **B3.** Proyección flujo de caja | Modelo predictivo (Python) + Claude | A1, A3, A10 implementados |
| **B4.** Consultas en lenguaje natural | Claude API + text-to-SQL | Modelo de datos estable |
| **B5.** Clasificación inteligente de gastos | Claude API | Historial de gastos clasificados |
| **B6.** Detección pagos duplicados | Análisis de similitud + Claude | Historial de pagos |
| **B7.** Análisis predictivo ejecución | Modelos de series de tiempo | Datos de al menos 1 año |
| **B8.** Resumen ejecutivo para Directorio | Claude API | Todos los módulos A implementados |

## 2. Fases de Desarrollo

### Fase 1 — MVP: Control Presupuestario y Dashboard
**Duración estimada:** 4-6 semanas
**Prioridad:** URGENTE

**Objetivo:** Que el Tesorero pueda ver el estado del presupuesto en tiempo real con semáforo y registrar gastos con control automático.

**Incluye:**
- Infraestructura base (proyecto, Docker, CI/CD, deploy)
- Autenticación y gestión de usuarios (JWT, roles)
- Modelo de datos completo (migraciones Alembic)
- Datos semilla (compañías, partidas 2026, cuentas bancarias)
- **A1: Control de ejecución presupuestaria** — CRUD de partidas, semáforo, bloqueo
- **A2: Alerta límite Superintendente** — validación al registrar gastos
- **A8: Dashboard financiero** — panel principal con widgets clave
- CRUD de gastos (registro, listado, filtros)
- Importación de presupuesto y gastos desde Excel
- Exportación de ejecución presupuestaria a Excel

**Entregable:** Sistema funcional donde el Tesorero puede:
1. Ver las 45 partidas con saldo disponible y semáforo
2. Registrar gastos que descuenten automáticamente de la partida
3. Recibir alertas cuando una partida está en amarillo/rojo
4. Ver un dashboard con el resumen del estado financiero
5. Importar datos existentes desde Excel

---

### Fase 2 — Control Operativo
**Duración estimada:** 4-6 semanas
**Prioridad:** ALTA

**Incluye:**
- **A3: Conciliación bancaria** — importar cartolas, cruce automático
- **A5: Verificación de respaldos documentales** — subida y validación de docs
- **A7: Seguimiento cierre por compañía** — tablero visual, recordatorios
- **A9: Flujo de aprobación de gastos** — circuito digital según monto
- **A10: Registro de deudas y acreencias** — control de obligaciones
- Gestión de cuentas bancarias y movimientos
- Portal de Director de Compañía (vista limitada)
- Registro de auditoría

---

### Fase 3 — Rendiciones y Cumplimiento
**Duración estimada:** 3-4 semanas
**Prioridad:** MEDIA

**Incluye:**
- **A4: Generación automática de rendiciones** — recopilación, verificación, formato SIRC
- **A6: Control de plazos de rendición** — calendario, alertas, countdown
- Exportación de rendiciones en formato compatible con SIRC
- Dashboard ejecutivo para Directorio (solo lectura)
- Reportes avanzados (comparativo interanual, por proveedor, por compañía)

---

### Fase 4 — Inteligencia Artificial
**Duración estimada:** 6-8 semanas (implementación gradual)
**Prioridad:** POSTERIOR

**Incluye (en orden sugerido):**
1. **B5:** Clasificación inteligente de gastos (quick win, mejora UX)
2. **B1:** Lectura inteligente de documentos (OCR + IA)
3. **B4:** Consultas en lenguaje natural
4. **B6:** Detección de pagos duplicados
5. **B2:** Detección de anomalías
6. **B3:** Proyección de flujo de caja
7. **B7:** Análisis predictivo de ejecución
8. **B8:** Resumen ejecutivo para Directorio

---

## 3. Criterios de Completitud por Fase

Cada fase se considera completa cuando:

- [ ] Todos los endpoints del backend tienen tests que pasan
- [ ] El frontend está funcional y probado en navegador
- [ ] Las reglas de negocio están implementadas y validadas
- [ ] Los datos semilla correspondientes están cargados
- [ ] La documentación API está actualizada (auto-generada por FastAPI)
- [ ] Deploy en producción funcional
- [ ] El Tesorero (o usuario correspondiente) ha validado la funcionalidad

## 4. Dependencias entre Módulos

```
A1 (Presupuesto) ──────► A2 (Límite Supt.)
       │                        │
       ▼                        ▼
A8 (Dashboard) ◄─── A9 (Aprobaciones)
       │
       ▼
A5 (Respaldos) ────► A4 (Rendiciones) ────► A6 (Plazos)
       │
       ▼
A3 (Conciliación)
       │
       ▼
A10 (Deudas) ──────► B3 (Proyección flujo)

A7 (Cierre compañías) ── independiente

B1-B8 (IA) ── dependen de datos acumulados en A1-A10
```

## 5. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Presupuesto 2026 no aprobado → no se puede pagar el desarrollo | Alto | Comenzar con MVP mínimo, usar herramientas gratuitas |
| Datos de Manager+ difíciles de exportar | Medio | Diseñar importador Excel flexible, no depender de formato fijo |
| Equipo del CBT no adopta el sistema | Alto | Involucrar al equipo desde Fase 1, dashboard como "gancho" visual |
| Cambios en Circular N°9 | Bajo | Reglas de negocio parametrizables, no hardcoded |
| API de Manager+ se necesita después | Bajo | La arquitectura permite agregar integración sin rediseño |
