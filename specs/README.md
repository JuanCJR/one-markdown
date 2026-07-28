# Especificaciones (SDD)

Una carpeta por feature: `NNN-slug/`. Solo el agente `orchestrator` escribe aquí.

```
NNN-slug/
  spec.md        QUÉ y POR QUÉ  — versionada semánticamente
  plan.md        CÓMO           — arquitectura, contratos, DTOs, esquema
  tasks.md       tareas atómicas TDD, cada una con su test
  CHANGELOG.md   historial de versiones de la spec
```

## Versionado de la spec

- **major** — cambia comportamiento observable ya implementado o rompe un contrato.
- **minor** — agrega alcance nuevo sin romper lo existente.
- **patch** — aclaraciones, correcciones, precisión de criterios.

Cada cambio de versión agrega entrada en el `CHANGELOG.md` de la feature con fecha y motivo.

## Plantillas

`_templates/spec.md`, `_templates/plan.md`, `_templates/tasks.md`, `_templates/CHANGELOG.md`.

## Índice de features

| # | Feature | Spec | Versión | Estado | Depende de |
|---|---------|------|---------|--------|------------|
| 000 | Foundation — monorepo, tooling, health/DTO base, CI | [`000-foundation/`](000-foundation/spec.md) | 0.1.7 | implemented — 14/14 AC (AC-5 ampliado en v0.1.5 y **cerrado en v0.1.6** por `T-024` de la spec `002`; **v0.1.7**: `optimizeDeps.force` en `vite.config.ts`, por `T-026` de la spec `002`) | — |
| 001 | Auth — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit | [`001-auth/`](001-auth/spec.md) | 0.1.1 | **implemented** — 26/26 AC (T-026 espera run de CI) · **v0.1.1**: el andamiaje e2e neutraliza a propósito los contadores de `register`/`login`, y **ese reset no debe llevarse a la suite del API** | 000 |
| 002 | Workspace tree — directorios/subdirectorios y documentos markdown (CRUD, propiedad por usuario) | [`002-workspace-tree/`](002-workspace-tree/spec.md) | 0.3.1 | **complete** (2026-07-25) — **35/35 AC** y **27/27 tareas** verificadas · web 12/**188** · api unit 19/**264** · api e2e 20/**455** · shared **65** · Playwright **5** · `--retries=2 --repeat-each=3` **15** · `typecheck`+`lint` de raíz en 0 · única salvedad de cobertura: el rojo de **AC-34** es **manual** y CI no lo caza (runner con `.vite` frío), escrito en el propio AC | 000, 001 |
| 003 | Editor — vista texto/preview, guardado, sanitización del preview | — | — | **sin especificar — es lo siguiente** | 002 |
| 004 | Markdown palette — listado de elementos markdown insertables | — | — | sin especificar | 003 |
| 005 | Tabs y split view — tabs tipo VS Code y vista dividida | — | — | sin especificar | 003 |

El orden de especificación sigue el de dependencias: cada spec se escribe cuando la anterior está
aprobada, para que sus criterios de aceptación se apoyen en contratos ya cerrados y no en supuestos.
