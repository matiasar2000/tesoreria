# Cierre formal IA-0

## Decision

IA-0 queda **cerrada y aceptada formalmente** el 2026-04-30.

El cierre toma como base el commit publicado:

```text
c115b40 feat(ia): consolidar asistente auditable con Langfuse
```

El alcance aceptado corresponde a una fundacion IA read-only para Tesoreria: consultas operativas, trazabilidad persistente, control de roles, separacion de auditoria tecnica y ausencia de escrituras financieras desde el endpoint IA.

## Alcance aceptado

| Area | Resultado |
|---|---|
| UI operativa | `/ia` disponible solo para `tesorero` y `equipo_tesoreria` |
| API IA | `POST /api/v1/ai/query` restringido a roles autorizados |
| Auditoria ERP | Cada consulta genera `ai_runs` y `audit_log` |
| Evidencia | Las respuestas incluyen fuentes navegables o limitaciones explicitas |
| Seguridad | No existe camino de escritura financiera desde `/ai/query` |
| Permisos | Roles no autorizados no ven `/ia`, son redirigidos y reciben 403 en API |
| Observabilidad tecnica | Langfuse v3 local queda separado de la UI de usuarios |
| Arquitectura | Workflow read-only separado en `ai_graph.py`; tools read-only separadas de `ai_service.py` |

## Evidencia de cierre

Validaciones ejecutadas durante el cierre de IA-0:

| Verificacion | Estado |
|---|---|
| `python -m compileall app tests` | OK |
| `pytest -p no:cacheprovider tests` | OK |
| `npm run lint` | OK |
| `npm run build` | OK |
| `docker compose build backend frontend` | OK |
| Consulta IA desde Docker | OK |
| Creacion de `ai_runs` | OK |
| Creacion de `audit_log` | OK |
| Bloqueo de `/ia` para rol no Tesoreria | OK |
| Trazas Langfuse locales | OK |
| Navegacion desde evidencia `fiscal_year` | OK |
| Navegacion desde evidencia `budget_item` | OK |

## Criterios de aceptacion

| Criterio IA-0 | Decision |
|---|---|
| Un usuario `tesorero` o `equipo_tesoreria` puede consultar `/ia` | Aceptado |
| La respuesta muestra evidencia o limitacion | Aceptado |
| Una consulta bancaria queda bloqueada para roles sin permiso | Aceptado |
| Toda consulta genera `ai_runs` | Aceptado |
| Toda consulta genera `audit_log` | Aceptado |
| No hay escrituras financieras desde `/ai/query` | Aceptado |
| La auditoria tecnica queda fuera de la UI operativa | Aceptado |

## Artefactos versionados

- `backend/app/services/ai_service.py`
- `backend/app/services/ai_graph.py`
- `backend/app/services/ai_observability.py`
- `backend/app/services/ai_tools/`
- `backend/app/api/v1/ai.py`
- `frontend/src/app/(app)/ia/page.tsx`
- `frontend/src/components/layout/sidebar.tsx`
- `frontend/src/lib/permissions.ts`
- `docs/08-arte-tecnico-ia-langgraph.md`
- `docs/09-implementacion-ia-0.md`
- `docs/10-langfuse-local.md`
- `docs/11-resumen-ejecutivo-ia-langgraph.md`

## Exclusiones del cierre

Lo siguiente queda fuera de IA-0 y pasa a hitos posteriores:

- Uso de un proveedor LLM real para razonamiento generativo.
- Checkpoints persistentes e interrupts humanos de LangGraph.
- Escrituras asistidas por IA.
- Clasificacion inteligente de gastos.
- OCR o lectura inteligente de documentos.
- Suites golden extensas para regresion de comportamiento.
- Streaming de respuestas en la UI.

## Deuda controlada

| Tema | Tratamiento |
|---|---|
| Langfuse local | Mantener separado del compose principal del ERP y documentado en `docs/10-langfuse-local.md` |
| Secretos | `.env` y `.env.langfuse` quedan fuera de Git |
| Evolucion de tools | Nuevas tools deben ser read-only por defecto y entrar por allowlist |
| Cambios de comportamiento IA | Versionar con `agent_behavior_version` y evidencia de pruebas |

## Proximo hito

El siguiente hito recomendado es **IA-1: Gastos y documentos**.

Primer entregable sugerido:

- Boton "Analizar con IA" en nuevo gasto.
- Sugerencia de clasificacion y partida.
- Persistencia de sugerencia solo con confirmacion humana.
- Auditoria en `ai_runs`/`audit_log`.
- Trazas tecnicas opcionales en Langfuse.

## Estado final

IA-0 queda cerrada como una base segura, auditable y operable para consultas read-only de Tesoreria.
