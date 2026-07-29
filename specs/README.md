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
| 001 | Auth — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit | [`001-auth/`](001-auth/spec.md) | 0.1.2 | **implemented** — 26/26 AC (T-026 espera run de CI) · **v0.1.1**: el andamiaje e2e neutraliza a propósito los contadores de `register`/`login`. **v0.1.2** (`T-015` de la `003`): se añade el reset de `throttle:workspace:*`; `documentContent` **no** se resetea (la suite gasta 4 de 120). La regla real sobre resets está en `003/tasks.md` `T-015`: importa **el momento** (en los límites sí, a mitad de una secuencia de agotamiento no), no el lugar | 000 |
| 002 | Workspace tree — directorios/subdirectorios y documentos markdown (CRUD, propiedad por usuario) | [`002-workspace-tree/`](002-workspace-tree/spec.md) | **0.4.4** | **complete** — **35/35 AC** y **27/27 tareas**. La enmienda de la **v0.4.0** (pedida por la `003`: `contentVersion` en la respuesta del documento y la ruta `PUT …/content` en el recuento) quedó **implementada y verificada** por `T-007`, `T-009` y `T-013` de esa spec. Tres patches más: **v0.4.1** (dos bytes de control que rompían `grep`), **v0.4.2** y **v0.4.3**, que ampliaron el alcance registrado de la enmienda — `workspace.repository.spec.ts` y `apps/web/src/test/workspace-fixtures.ts`. Las dos veces el agente **paró y reportó**, y las dos por el mismo motivo: el radio de un cambio de contrato incluye **los fixtures de test**. Salvedad de cobertura vigente: el rojo de **AC-34** es **manual** y CI no lo caza | 000, 001 |
| 003 | Editor — vista texto/preview, guardado, sanitización del preview | [`003-editor/`](003-editor/spec.md) | **0.1.4** | **complete** (2026-07-28) — **34/34 AC** y **17/17 tareas** verificadas · shared **81** · web 16/**321** · api unit 21/**305** · api e2e 22/**511** · `pnpm test:e2e` **8** · `--retries=2 --repeat-each=3` **24** sin un solo `429` · `typecheck`+`lint` en 0. **Sin ninguna salvedad de verificación manual** (a diferencia del AC-34 de la `002`). Decisiones: `PUT …/content` como ruta nueva · columna `contentVersion` · `react-markdown` + `remark-gfm` + `rehypeRawAsText` + `rehype-sanitize`, con el HTML embebido **como texto literal, nunca renderizado** · `<textarea>` plano · «split view» = texto y preview del **mismo** documento. Dos deudas con destinatario en su §8: deduplicar `open(id)` (→ `005`) y la ventana estrecha de AC-33, **no estabilizada a propósito** | 002 |
| 004 | Markdown palette — listado de elementos markdown insertables | — | — | sin especificar · la `003` ya le deja cerrado el contrato: un solo `<textarea>` y `setDraft(id, texto)` como único camino de cambio de contenido (`003/spec.md` §4) | 003 |
| 005 | Tabs y split view — tabs tipo VS Code y vista dividida | — | — | sin especificar · la `003` ya le deja cerrado el contrato: estado del editor **indexado por id de documento**, no un singleton (`003/plan.md`, decisión 9). **«Split view» ya está definido** (2026-07-28): texto y preview lado a lado del **mismo** documento, fijado en `CLAUDE.md` — así que el split es un cambio de disposición sobre los paneles de la `003`, no un segundo estado. La política de desalojo del store sigue siendo suya, por los **tabs** | 003 |

El orden de especificación sigue el de dependencias: cada spec se escribe cuando la anterior está
aprobada, para que sus criterios de aceptación se apoyen en contratos ya cerrados y no en supuestos.
