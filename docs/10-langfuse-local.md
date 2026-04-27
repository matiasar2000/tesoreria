# Langfuse v3 local para auditoria tecnica de IA

Este documento define una instalacion local y separada de Langfuse v3 para trazas tecnicas de IA. No reemplaza `ai_runs` ni `audit_log`: esas tablas siguen siendo la auditoria operativa visible y controlada dentro del ERP. Langfuse queda como consola tecnica para depurar prompts, herramientas, latencia, errores, costos y observaciones internas de ejecuciones IA.

## Decision

- Mantener Langfuse fuera del `docker-compose.yml` principal para no mezclar la UI de Tesoreria (`/ia`) con la observabilidad tecnica.
- Usar `docker-compose.langfuse.yml` con proyecto Compose propio (`tesoreria-langfuse`).
- Exponer la UI de Langfuse en `http://localhost:3002`, porque el frontend del ERP ya usa `http://localhost:3000`.
- Mantener la base Postgres del ERP separada de la Postgres interna de Langfuse.
- No versionar secretos reales. Las credenciales locales viven en `.env.langfuse`, ignorado por Git.

## Puertos locales

| Servicio | Puerto host | Uso |
|---|---:|---|
| Langfuse web | `3002` | UI y API de Langfuse |
| Langfuse worker | `127.0.0.1:3030` | Worker interno, expuesto solo local |
| Postgres Langfuse | `127.0.0.1:5433` | Base transaccional de Langfuse |
| ClickHouse HTTP | `127.0.0.1:8124` | OLAP de trazas |
| ClickHouse TCP | `127.0.0.1:9002` | Migraciones ClickHouse |
| Redis | `127.0.0.1:6380` | Colas/cache |
| MinIO S3 | `9090` | Blob storage usado por Langfuse |
| MinIO console | `127.0.0.1:9091` | Consola administrativa local |

## Levantar localmente

1. Crear variables locales:

```powershell
Copy-Item .env.langfuse.example .env.langfuse
```

2. Reemplazar todos los valores `CHANGE_ME` en `.env.langfuse`.

Generadores sugeridos:

```bash
openssl rand -base64 32
openssl rand -hex 32
```

`ENCRYPTION_KEY` debe ser hexadecimal de 64 caracteres.

3. Levantar el stack:

```powershell
docker compose --env-file .env.langfuse -f docker-compose.langfuse.yml up -d
```

4. Revisar logs hasta que `langfuse-web` quede listo:

```powershell
docker compose -f docker-compose.langfuse.yml logs -f langfuse-web
```

5. Abrir:

```text
http://localhost:3002
```

Si no se configuraron variables `LANGFUSE_INIT_*`, crear el usuario, organizacion y proyecto desde la UI.

## Detener y limpiar

Detener contenedores:

```powershell
docker compose -f docker-compose.langfuse.yml down
```

Eliminar tambien datos locales de Langfuse:

```powershell
docker compose -f docker-compose.langfuse.yml down -v
```

## Integracion posterior con backend

Cuando se instrumente el backend FastAPI, agregar variables al entorno del servicio `backend` o a `backend/.env` local:

```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=http://host.docker.internal:3002
```

Notas:

- Desde el contenedor `backend`, `localhost:3002` apunta al propio contenedor, no al host. En Docker Desktop para Windows, usar `host.docker.internal:3002`.
- Desde procesos ejecutados directamente en la maquina host, usar `http://localhost:3002`.
- Mantener `ai_runs.run_id` como correlacion principal del ERP y enviarlo a Langfuse como trace id, metadata o tag segun la libreria elegida.
- Registrar en Langfuse datos tecnicos, no secretos ni payloads financieros completos innecesarios.
- La UI `/ia` no debe leer desde Langfuse. Si se necesita mostrar auditoria al usuario de Tesoreria, usar `ai_runs` y `audit_log`.

Variables minimas esperadas por el SDK actual:

```env
LANGFUSE_PUBLIC_KEY=pk-lf-...
LANGFUSE_SECRET_KEY=sk-lf-...
LANGFUSE_BASE_URL=http://host.docker.internal:3002
```

Segun la documentacion oficial actual, el SDK Python v3 requiere una plataforma Langfuse self-hosted compatible con version 3.125.0 o superior. El tag Docker `:3` mantiene el stack en la linea mayor v3; si mas adelante se fijan imagenes por version exacta, validar ese minimo antes de instrumentar el backend.

## Fuentes oficiales consultadas

- Langfuse Self Hosting v3: https://langfuse.com/self-hosting
- Langfuse Docker Compose v3: https://langfuse.com/self-hosting/deployment/docker-compose
- Langfuse Environment Variables v3: https://langfuse.com/self-hosting/configuration
- Langfuse GitHub repository and official compose reference: https://github.com/langfuse/langfuse
- Langfuse SDK overview: https://langfuse.com/docs/integrations/sdk/python
