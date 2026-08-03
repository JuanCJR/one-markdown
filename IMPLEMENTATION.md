# One Markdown — Seguimiento de implementación

Índice de estado. **Solo el agente `orchestrator` lo edita**, y únicamente después de verificar
(comando corrido + salida real).

Leyenda: `[ ]` pendiente · `[~]` en curso o bloqueado (con motivo) · `[x]` hecho y verificado.

> **Este documento no crece.** Cuando una fase cierra, se comprime a una fila y su detalle se muda al
> `CHANGELOG` de su spec, que es donde se busca. El 2026-08-03 se movieron así **3.030 líneas** de las
> 3.317 que tenía: cada `CHANGELOG` lleva al final la sección *«Registro de implementación — movido
> desde `IMPLEMENTATION.md`»* con el texto literal.
>
> Y la regla que hizo falta escribir: **un dato de este archivo no se cita sin recomprobarlo.** Es una
> fuente secundaria; la primaria es el comando. Dos notas de aquí resultaron falsas al comprobarlas
> (ver «Corregido el 2026-08-03»).

## Estado por spec

| Spec | Versión | Estado | Detalle |
|---|---|---|---|
| `000-foundation` | 0.1.7 | implemented — 14/14 AC · 16/16 tareas | [`CHANGELOG`](specs/000-foundation/CHANGELOG.md) |
| `001-auth` | 0.1.4 | implemented — 26/26 AC · 26/26 tareas | [`CHANGELOG`](specs/001-auth/CHANGELOG.md) |
| `002-workspace-tree` | 0.4.4 | complete — 35/35 AC · 27/27 tareas | [`CHANGELOG`](specs/002-workspace-tree/CHANGELOG.md) |
| `003-editor` | 0.2.0 | complete — 34/34 AC · 17/17 tareas | [`CHANGELOG`](specs/003-editor/CHANGELOG.md) |
| `004-markdown-palette` | 0.3.1 | complete — 36/36 AC · 12/12 tareas | [`CHANGELOG`](specs/004-markdown-palette/CHANGELOG.md) |
| `005-tabs-split-view` | 0.2.1 | complete — 34/34 AC · 12/12 tareas | [`CHANGELOG`](specs/005-tabs-split-view/CHANGELOG.md) |
| `006-editor-undo` | 0.1.3 | complete — 36/36 AC · 10/10 tareas | [`CHANGELOG`](specs/006-editor-undo/CHANGELOG.md) |

Índice, dependencias y plantillas: [`specs/README.md`](specs/README.md).

## Fases

| Fase | Qué | Tareas | Cuándo | Detalle |
|---|---|---|---|---|
| 0 | Agentes, skills, MCP y andamiaje del monorepo | 5/5 | 2026-07-24 | abajo, y [`.claude/README.md`](.claude/README.md) |
| 1 | Planificación SDD de las siete specs | 7/7 | 07-24 → 07-29 | «Planificación de la spec» en cada `CHANGELOG` |
| 2 | `000-foundation` | 16/16 | 07-24 → 07-25 | [`CHANGELOG`](specs/000-foundation/CHANGELOG.md) |
| 3 | `001-auth` | 26/26 | 07-24 → 07-25 | [`CHANGELOG`](specs/001-auth/CHANGELOG.md) |
| 4 | `002-workspace-tree` | 27/27 | 2026-07-25 | [`CHANGELOG`](specs/002-workspace-tree/CHANGELOG.md) |
| 5 | `003-editor` | 17/17 | 07-25 → 07-28 | [`CHANGELOG`](specs/003-editor/CHANGELOG.md) |
| 6 | `004-markdown-palette` | 12/12 | 07-24 → 07-29 | [`CHANGELOG`](specs/004-markdown-palette/CHANGELOG.md) |
| 7 | `005-tabs-split-view` | 12/12 | 2026-07-29 | [`CHANGELOG`](specs/005-tabs-split-view/CHANGELOG.md) |
| 8 | `006-editor-undo` | 10/10 | 07-29 → 08-01 | [`CHANGELOG`](specs/006-editor-undo/CHANGELOG.md) |
| 9 | Retrospectiva y reforma del harness | 7/7 mejoras | 2026-08-03 | [retrospectiva](docs/retrospectivas/2026-08-01-metodologia.md) · [`.claude/README.md`](.claude/README.md) |

De la fase 9, cinco mejoras quedan verificadas hoy y tres solo lo estarán con la próxima feature: que
los subagentes vuelvan a ejecutar, qué skills se usan de verdad, y que el método aguante viviendo en
skills que hay que cargar. Está escrito como tal al final de la retrospectiva.

**Las cinco capacidades del párrafo de cabecera de `CLAUDE.md` están implementadas.**

## Fase 0 — Agentes y tooling (2026-07-24)

- [x] **Agentes, skills y MCP** — `.claude/agents/{orchestrator,frontend,backend}.md`, 15 skills en
      `.claude/skills/`, `.mcp.json` con `context7`, `playwright`, `coderag` y `postgres`.
      **Reformado el 2026-08-03**: el método se movió a cuatro skills propias y la configuración del
      harness pasó a estar versionada. Detalle en [`.claude/README.md`](.claude/README.md).
- [x] **Base de metodología** — `specs/` con las cuatro plantillas SDD, `CLAUDE.md` y este archivo.
- [x] **Scaffolding del monorepo** — `apps/web`, `apps/api`, `packages/shared`, `docker-compose.yml`
      (postgres + redis) y CI.
      Verificado: `pnpm typecheck` → 0 · `pnpm lint` → 0 · `pnpm test` → 0 · `pnpm build` → 0 ·
      `pnpm test:e2e` → 3 passed.

## Lo que queda abierto

- [~] **`T-002` de la `000`** — `.env.example` no se pudo tocar: las reglas de permisos deniegan
      `.env.*`. Lo actualiza el usuario. **Falta confirmar** que la raíz y `apps/api` tengan las siete
      claves de `000/plan.md` §4 y las cinco de `001` (`JWT_ACCESS_TTL`, `JWT_REFRESH_TTL`,
      `BCRYPT_ROUNDS`, `MFA_ENCRYPTION_KEY`, `MFA_ISSUER`).
      Desvío conocido y aceptado: PostgreSQL escucha en el **5433** del host, el 5432 estaba ocupado.
      **Perder `MFA_ENCRYPTION_KEY` inutiliza los secretos TOTP ya guardados.**
- [ ] **Tres revisiones manuales declaradas**, que ningún test de este repositorio puede cubrir y que
      están escritas como tales en sus specs: lector de pantalla real · `Ctrl`+`Y` en Firefox sobre
      Windows · `AC-34` de la `002`. No son deuda de código.
- [ ] **Mitad negativa del CI para los pasos de test unitario y de e2e de API.** Ningún run ha mostrado
      todavía un `Unit tests` o un `API e2e tests` en rojo, así que no está demostrado con esos dos
      pasos concretos que el job se ponga rojo por un test que falla. Sí está demostrado con
      `Typecheck` (run `30139345799`) y con `Web e2e tests` (run `30143727278`).

## Corregido el 2026-08-03 — dos notas que este archivo daba por buenas y eran falsas

Las dos se comprobaron contra la fuente primaria (`gh run view`), no contra el propio seguimiento.

- **`T-026` de la `001` pasa de `[~]` a `[x]`.** Estaba bloqueada «esperando un run verde de CI» desde
  el 2026-07-25. Ya lo hay: run **`30711094472`** (2026-08-01, `main`) con `Apply Prisma migrations`,
  `Unit tests`, `API e2e tests`, `Build` y `Web e2e tests` **todos en verde** en `verify (node 22)`, y
  todo menos el e2e de navegador en `verify (node 24)`, que es como está diseñado. Los diez últimos
  runs están en verde.
- **La nota que daba la verificación negativa por cubierta con el run `30139345799` era falsa.** Ese
  run murió en el paso 10, `Typecheck`, en las dos versiones de Node, y dejó `Unit tests`,
  `API e2e tests`, `Build` y `Web e2e tests` en **`skipped`**. Demuestra que un `Typecheck` rojo pone
  el job rojo; no demuestra nada sobre los pasos de test. Lo que sí cubre esa mitad, para el e2e de
  navegador, es el run **`30143727278`**, que falló exactamente en `Web e2e tests`.

## Pendiente del usuario

1. **`.env.example`** — ver `T-002` arriba. Es lo único que el repositorio no puede comprobar solo.
2. **`git push`** — la reforma del harness está commiteada en local; empujarla es del usuario, la
   sesión tiene `git push` denegado.
3. **Pedir la delegación al arrancar la `007`.** Si el trabajo va a correr en segundo plano, la
   petición tiene que ser explícita («delegando en `frontend` y `backend`»), o los subagentes no se
   usarán y el hook lo registrará como `main`.
