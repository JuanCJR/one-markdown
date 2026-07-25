# One Markdown — Seguimiento de implementación

Archivo base de seguimiento. **Solo el agente `orchestrator` lo edita**, y únicamente después de verificar (comando corrido + salida real).

Leyenda: `[ ]` pendiente · `[~]` en curso o bloqueado (con motivo) · `[x]` hecho y verificado.

---

## Fase 0 — Agentes y tooling

- [x] **Discovery de skills** en skills.sh (`npx skills find`) — 2026-07-24
      Verificado: 15 skills instaladas a nivel proyecto en `.claude/skills/`, registradas en `skills-lock.json` (`ls .claude/skills` → 15 entradas).
- [x] **Agentes definidos** — 2026-07-24
      `.claude/agents/orchestrator.md`, `frontend.md`, `backend.md` con skills asignadas por rol.
- [x] **MCP integrados** — 2026-07-24
      `.mcp.json`: `context7`, `playwright`, `coderag`, `postgres`. Pendiente de handshake en el próximo arranque de sesión (ver nota abajo).
- [x] **Base de metodología** — 2026-07-24
      `specs/` con plantillas SDD (`spec.md`, `plan.md`, `tasks.md`, `CHANGELOG.md`), `CLAUDE.md` con reglas del proyecto, este archivo de seguimiento.
- [ ] **Scaffolding del monorepo**
      `apps/web` (Vite+React+TS+Tailwind+Zustand+Router+Vitest+Playwright), `apps/api` (NestJS+Prisma+Redis+Swagger+Jest), `packages/shared`, `docker-compose.yml` (postgres+redis), CI.
      Sale de la spec `000-foundation`, aún no escrita.

## Fase 1 — Planificación SDD

- [ ] **spec 000-foundation** — scaffolding, tooling, CI, esquema base.
- [ ] **spec 001-auth** — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit.
- [ ] **spec 002-workspace-tree** — directorios/subdirectorios y documentos markdown (CRUD, propiedad por usuario).
- [ ] **spec 003-editor** — vista texto/preview, guardado, sanitización del preview.
- [ ] **spec 004-markdown-palette** — listado de elementos markdown insertables.
- [ ] **spec 005-tabs-split-view** — tabs tipo VS Code y vista dividida.

_(El desglose anterior es el mapa propuesto, no está especificado todavía. La planificación es el siguiente paso y la hace el `orchestrator` con SDD + TDD.)_

---

## Notas de verificación

- **2026-07-24** — Skills instaladas con `npx skills add <repo> --skill <name> -y --copy`. `.claude/skills/` y `.agents/` están en `.gitignore`; `skills-lock.json` sí se versiona y permite restaurar con `npx skills experimental_install`.
- **2026-07-24** — La skill `test-driven-development-tdd` venía con `name: Test-Driven Development (TDD)` en su frontmatter; se normalizó a kebab-case para que Claude Code la cargue.
- **2026-07-24** — Los servidores MCP declarados en `.mcp.json` se conectan al iniciar sesión en este directorio; `postgres` requiere `DATABASE_URL` y una base levantada (aún no existe), así que aparecerá desconectado hasta la Fase 0 de scaffolding.
