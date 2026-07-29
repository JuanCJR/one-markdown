# One Markdown

App web para gestionar archivos markdown organizados en categorías/directorios y subdirectorios: crear, editar, eliminar y visualizar. Visualización en modo texto o preview, paleta de elementos markdown para usuarios que no dominan la sintaxis, tabs tipo VS Code al abrir documentos y **split view: texto y preview lado a lado del mismo documento** (no dos documentos distintos).

## Estructura

```
apps/web           React 19 + TS, Vite, Tailwind, Zustand, React Router  (@one-markdown/web)
apps/api           NestJS + TS, PostgreSQL, Prisma, Redis, JWT/MFA       (@one-markdown/api)
packages/shared    tipos/contratos derivados de los DTO del backend      (@one-markdown/shared)
specs/             especificaciones SDD versionadas (una carpeta por feature)
IMPLEMENTATION.md  seguimiento maestro de la implementación (solo el orchestrator lo edita)
```

Monorepo pnpm workspaces. Node ≥ 22.

## Agentes

| Agente | Rol |
|---|---|
| `orchestrator` | Analiza, especifica (SDD), planifica (TDD), delega y verifica. Dueño de `specs/**` e `IMPLEMENTATION.md`. |
| `frontend` | Implementa `apps/web`. |
| `backend` | Implementa `apps/api`. |

Cualquier feature o cambio significativo entra por el `orchestrator`. Los agentes de implementación solo ejecutan tareas `T-NNN` ya especificadas, en TDD.

## Metodología

- **SDD**: nada se implementa sin spec en `specs/NNN-slug/` (`spec.md` + `plan.md` + `tasks.md` + `CHANGELOG.md`). La spec se versiona semánticamente; cada cambio deja entrada en su CHANGELOG.
- **TDD**: RED → GREEN → REFACTOR. El test se escribe primero y debe fallar antes de implementar. Cada criterio de aceptación (`AC-N`) tiene al menos un test automatizado.
- **Seguimiento**: `IMPLEMENTATION.md` se actualiza solo tras verificar (comando corrido + salida real). `[ ]` pendiente · `[~]` en curso/bloqueado con motivo · `[x]` hecho y verificado.

## Reglas de código

### Backend (regla dura)
Toda entrada y toda salida de cada endpoint pasa por un DTO explícito: `*.request.dto.ts` validado con class-validator y `*.response.dto.ts` construido explícitamente, ambos documentados con Swagger. Nunca se devuelve una entidad Prisma cruda. `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`. Cero `any`.

### General
- TypeScript estricto en todos los paquetes.
- Autorización por recurso: todo acceso a documentos/directorios se filtra por el `userId` del token.
- El backend es el dueño del auth (JWT access+refresh, bcrypt, MFA TOTP, Passport, Redis). Auth.js está fuera de alcance.
- Preview de markdown siempre sanitizado.
- Secretos solo por variables de entorno validadas al arrancar; nada en el repo.

## MCP disponibles (`.mcp.json`)

`context7` docs actualizadas de librerías · `coderag` búsqueda semántica del código · `postgres` inspección del esquema real (lectura; las migraciones van por Prisma) · `playwright` verificación en navegador y e2e.

## Comandos

```bash
pnpm install
pnpm dev            # web + api en paralelo
pnpm test           # unit de todos los paquetes
pnpm test:e2e       # Playwright (web)
pnpm typecheck
pnpm lint
```
