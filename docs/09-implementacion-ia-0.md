# Implementacion IA-0: Asistente read-only de Tesoreria

Documentacion tecnica del primer corte de integracion IA basado en el arte tecnico de `docs/08-arte-tecnico-ia-langgraph.md`.

Este entregable implementa una base operativa **read-only** para consultas de Tesoreria. No integra aun un proveedor LLM ni LangGraph como dependencia runtime; deja el backend preparado con estado auditable, permisos, trazabilidad de tools y una primera experiencia frontend.

---

## 1. Objetivo

IA-0 busca habilitar preguntas operativas sin riesgo de modificar datos financieros.

El sistema puede:

- Clasificar una pregunta en una intencion operativa.
- Validar alcance segun rol.
- Consultar datos internos mediante funciones controladas.
- Responder con fuentes internas, hallazgos y confianza.
- Registrar una corrida auditable en `ai_runs`.

El sistema no puede:

- Aprobar gastos.
- Conciliar movimientos.
- Crear rendiciones.
- Modificar presupuesto, gastos, banco, usuarios ni documentos.
- Ejecutar tools de escritura.

La regla aplicada es: **la IA consulta y explica; el backend valida; la persona decide**.

---

## 2. Alcance implementado

### Backend

Archivos principales:

| Archivo | Proposito |
|---|---|
| `backend/app/api/v1/ai.py` | Endpoints publicos del modulo IA |
| `backend/app/services/ai_service.py` | Orquestacion read-only, clasificacion, guardrails y armado de respuesta |
| `backend/app/schemas/ai.py` | Schemas Pydantic de requests, respuestas, sources, findings y tool calls |
| `backend/app/models/ai_run.py` | Modelo persistente de corrida IA |
| `backend/alembic/versions/d3e7b7a9c1f2_add_ai_runs_table.py` | Migracion de tabla `ai_runs` |
| `backend/tests/test_ai_service.py` | Tests minimos del clasificador y politica read-only |

### Frontend

Archivos principales:

| Archivo | Proposito |
|---|---|
| `frontend/src/app/(app)/ia/page.tsx` | Pantalla "Asistente IA" |
| `frontend/src/components/layout/sidebar.tsx` | Entrada de navegacion `/ia` |
| `frontend/src/types/api.ts` | Tipos TypeScript para la API IA |

---

## 3. Endpoints

### `POST /api/v1/ai/query`

Ejecuta una consulta read-only.

Request:

```json
{
  "question": "Que partidas estan en rojo?",
  "year": 2026,
  "thread_id": null
}
```

Response:

```json
{
  "run_id": "uuid",
  "thread_id": "uuid",
  "status": "finalizado",
  "intent": "budget_status",
  "answer": "Segun el presupuesto 2026...",
  "confidence": 0.92,
  "sources": [],
  "findings": [],
  "proposed_actions": [],
  "tool_calls": []
}
```

Notas:

- Requiere usuario autenticado.
- Toda ejecucion genera una fila en `ai_runs`.
- Tambien registra auditoria en `audit_log` con accion `ai_query`.
- No ejecuta escrituras financieras.

### `GET /api/v1/ai/runs/{run_id}`

Obtiene el detalle auditable de una corrida IA.

Reglas de acceso:

- El usuario que ejecuto la corrida puede verla.
- Roles de Tesoreria pueden revisar corridas.
- Otros usuarios quedan bloqueados.

### `GET /api/v1/ai/runs`

Lista corridas IA paginadas para auditoria operativa.

Query params:

- `intent`: filtro opcional por intencion.
- `status`: filtro opcional por estado.
- `page`: pagina, por defecto `1`.
- `page_size`: tamano de pagina, por defecto `20`, maximo `100`.

Reglas de acceso:

- Roles de Tesoreria pueden ver todas las corridas.
- Roles fuera de Tesoreria solo ven sus propias corridas.

---

## 4. Intenciones soportadas

El clasificador inicial es determinista. Mapea palabras clave a flujos read-only.

| Intencion | Ejemplos | Tools internas consultadas |
|---|---|---|
| `budget_status` | "Que partidas estan en rojo?", "Cuanto queda disponible?" | Presupuesto y partidas |
| `pending_expenses` | "Que gastos pendientes hay?" | Gastos pendientes |
| `expenses_over_imm` | "Gastos mayores a 5 IMM" | Gastos sobre umbral 5 IMM |
| `bank_reconciliation` | "Movimientos sin conciliar" | Banco y conciliacion |
| `rendition_status` | "Rendiciones pendientes" | Rendiciones |
| `alerts` | "Alertas criticas" | Alertas visibles |
| `overview` | Preguntas generales | Resumen combinado |

---

## 5. Guardrails activos

### Politica runtime

El backend define `policy_context` con:

```json
{
  "mode": "read_only",
  "writes_allowed": false,
  "guardrails": [
    "no_financial_writes",
    "role_filtered_tools",
    "source_based_answers",
    "human_review_required_for_sensitive_actions"
  ]
}
```

### Control de rol

El flujo valida alcance antes de recuperar contexto.

Ejemplo:

- `bank_reconciliation` solo permite roles `tesorero` y `equipo_tesoreria`.
- Si un usuario sin permiso pregunta por banco, la corrida termina como `bloqueado`.

### Respuestas con evidencia

Cada respuesta puede incluir:

- `sources`: entidades internas usadas como evidencia.
- `findings`: advertencias, bloqueos o riesgos.
- `tool_calls`: tools internas ejecutadas y resumen de resultado.
- `confidence`: confianza declarada del flujo.

---

## 6. Tabla `ai_runs`

La tabla guarda estado estructurado de cada corrida.

Campos principales:

| Campo | Proposito |
|---|---|
| `id` | Identificador de corrida |
| `thread_id` | Continuidad de conversacion |
| `user_id` | Usuario que inicio la consulta |
| `status` | Estado final o intermedio |
| `intent` | Intencion clasificada |
| `input_payload` | Pregunta, ano y payload inicial |
| `user_context` | Rol, compania y permisos efectivos |
| `domain_context` | Datos internos recuperados |
| `policy_context` | Guardrails aplicados |
| `tool_calls` | Tools invocadas |
| `findings` | Hallazgos y advertencias |
| `confidence` | Confianza declarada |
| `proposed_actions` | Acciones sugeridas, no aplicadas |
| `human_review` | Reservado para futuras pausas humanas |
| `final_response` | Respuesta visible |
| `audit_trace` | Nodos visitados y tiempos |

---

## 7. Flujo actual

Flujo simplificado de `run_read_only_query`:

1. Crear `AiRun` con estado `iniciado`.
2. Normalizar payload.
3. Clasificar intencion.
4. Validar alcance por rol.
5. Si no hay permiso, cerrar como `bloqueado`.
6. Recuperar contexto minimo necesario.
7. Generar respuesta determinista con evidencia.
8. Guardar `domain_context`, `tool_calls`, `findings`, `confidence` y `audit_trace`.
9. Registrar `audit_log`.
10. Retornar respuesta al frontend.

Este flujo representa el esqueleto que luego puede reemplazarse o envolverse con LangGraph.

---

## 8. Pantalla `/ia`

La pantalla permite:

- Enviar una pregunta.
- Elegir ano fiscal.
- Reutilizar `thread_id` entre consultas.
- Ver respuesta principal.
- Ver hallazgos.
- Ver evidencia interna.
- Ver tools ejecutadas.
- Ver estado, intencion y confianza.
- Ver historial de corridas IA.
- Seleccionar una corrida y revisar su detalle auditable.
- Revisar payload, contexto de usuario, policies, tools, hallazgos y traza.

Preguntas sugeridas iniciales:

- "Que partidas estan en rojo?"
- "Que gastos pendientes de aprobacion hay?"
- "Que movimientos bancarios no estan conciliados?"
- "Que rendiciones estan pendientes?"

---

## 9. Verificacion

Comandos ejecutados:

```bash
# Backend
python -m compileall app tests
python -m pytest -p no:cacheprovider tests
python -c "from app.main import app; print(app.title)"

# Frontend
npm run build
npm run lint
```

Resultado:

- `compileall`: OK
- `pytest -p no:cacheprovider tests`: OK, 2 tests passed
- Import de FastAPI app con venv: OK
- `npm run build`: OK
- `npm run lint`: falla por deuda previa en archivos no relacionados:
  - `frontend/src/app/(app)/banco/page.tsx`
  - `frontend/src/app/(app)/rendiciones/page.tsx`
  - `frontend/src/lib/auth.tsx`
  - warnings existentes en `alertas` y `dashboard`

Nota operacional: se agrego a `.gitignore` el patron `pytest-cache-files-*/` porque pytest genero carpetas temporales con ACL restringida en Windows.

---

## 10. Limites conocidos

- No hay integracion real con LangGraph todavia.
- No hay llamada a LLM.
- La clasificacion de intencion es por palabras clave.
- Las respuestas son deterministas y ejecutivas.
- No hay streaming ni historial visual completo.
- `human_review` queda reservado para IA-1/IA-3.
- No existen tools de escritura IA habilitadas.

Estos limites son intencionales para IA-0: primero control, auditoria y lectura segura.

---

## 11. Siguientes pasos recomendados

### IA-0.1

- Consulta operativa en frontend: implementada en `/ia`.
- Listado y detalle auditable de `ai_runs`: disponible por API.
- Trazas tecnicas y auditoria avanzada: fuera de `/ia`; se centralizan en Langfuse local.

### IA-0.2

- Tools read-only separadas en `backend/app/services/ai_tools/`.
- Interfaz estable `ReadOnlyToolContext` para tool calls, fuentes y hallazgos.
- Orquestacion principal mantenida en `ai_service.py`.
- Tests de permisos por rol vigentes para bloqueo bancario.
- Auditoria tecnica separada de la UI `/ia` mediante stack local Langfuse documentado en `docs/10-langfuse-local.md`.

### IA-1

- Implementar boton "Analizar con IA" en nuevo gasto.
- Extraer/sugerir clasificacion de gasto sin escribir automaticamente.
- Guardar sugerencia IA solo con confirmacion humana.

### LangGraph

- Instalar dependencia cuando se defina proveedor IA y estrategia de ejecucion.
- Convertir el flujo actual en nodos equivalentes:
  - `receive_request`
  - `authorize_scope`
  - `classify_intent`
  - `retrieve_context`
  - `draft_answer`
  - `log_audit`
  - `finalize_response`

---

## 12. Criterio de aceptacion IA-0

IA-0 queda aceptado si:

- Un usuario autenticado puede consultar `/ia`.
- La respuesta muestra evidencia o limitacion.
- Una consulta bancaria queda bloqueada para roles sin permiso.
- Toda consulta genera `ai_runs`.
- Toda consulta genera `audit_log`.
- No existe ningun camino de escritura financiera desde `/ai/query`.

Estado de cierre:

| Criterio | Estado |
|---|---|
| Consulta autenticada en `/ia` | Cerrado. Validado con login `tesorero@cbt.cl` y consulta desde UI |
| Respuesta con evidencia o limitacion | Cerrado. La UI muestra respuesta, hallazgos y evidencia |
| Bloqueo de banco por rol sin permiso | Cerrado. API devuelve `bloqueado` para `directorio@cbt.cl` con `bank_scope_denied` |
| Persistencia en `ai_runs` | Cerrado. `POST /ai/query` crea corrida y `GET /ai/runs/{id}` devuelve detalle auditable |
| Registro en `audit_log` | Cerrado. Cada corrida verificada genera `audit_log.action = ai_query` |
| Sin escritura financiera desde `/ai/query` | Cerrado. Conteos de tablas financieras permanecen iguales; solo aumentan `ai_runs` y `audit_log` |

Validacion de cierre ejecutada el 2026-04-27:

| Verificacion | Resultado |
|---|---|
| `python -m compileall app tests` | OK |
| `pytest -p no:cacheprovider tests` | OK, 4 tests passed |
| `npm run build` | OK |
| `npx eslint src/app/(app)/ia/page.tsx src/types/api.ts` | OK |
| `docker-compose build backend frontend` | OK |
| Login y consulta desde `/ia` con Playwright | OK |
| Evidencia `fiscal_year` a `/presupuesto` | OK |
| Evidencia `budget_item` a `/presupuesto/{id}` | OK |
| UI `/ia` sin trazas tecnicas para usuarios de Tesoreria | OK |

Observacion: `npm run lint` global queda limpio despues de corregir deuda previa en `banco`, `rendiciones`, `auth`, `alertas` y `dashboard`.

Resultado: **IA-0 cerrado y aceptado funcionalmente** como asistente read-only auditable.
