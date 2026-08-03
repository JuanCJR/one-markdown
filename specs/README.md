# Especificaciones (SDD)

Una carpeta por feature: `NNN-slug/`. Solo el agente `orchestrator` escribe aquí.

```
NNN-slug/
  spec.md        QUÉ y POR QUÉ  — versionada semánticamente
  plan.md        CÓMO           — arquitectura, contratos, DTOs, esquema
  tasks.md       tareas atómicas TDD, cada una con su test
  CHANGELOG.md   historial de versiones + registro de implementación
```

El método —qué va en cada documento, cómo se versiona y cómo se redacta un criterio que se pueda
desmentir— vive en la skill `spec-driven-development`, no aquí.

**Plantillas**: `_templates/{spec,plan,tasks,CHANGELOG}.md`.

## Índice

**Una línea por spec.** Todo el detalle —versiones, motivos, registro de implementación y notas de
verificación— vive en el `CHANGELOG` de cada una, que es el único documento que crece.

| # | Feature | Versión | Estado | Depende de |
|---|---|---|---|---|
| [000](000-foundation/spec.md) | Foundation — monorepo, tooling, health/DTO base, CI | 0.1.7 | implemented · 14/14 AC | — |
| [001](001-auth/spec.md) | Auth — registro, login, JWT access+refresh, bcrypt, MFA TOTP, Redis, rate limit | 0.1.4 | implemented · 26/26 AC | 000 |
| [002](002-workspace-tree/spec.md) | Workspace tree — directorios y documentos del usuario | 0.4.4 | complete · 35/35 AC | 000, 001 |
| [003](003-editor/spec.md) | Editor — vista texto/preview, guardado, sanitización | 0.2.0 | complete · 34/34 AC | 002 |
| [004](004-markdown-palette/spec.md) | Markdown palette — paleta de elementos insertables | 0.3.1 | complete · 36/36 AC | 003 |
| [005](005-tabs-split-view/spec.md) | Tabs y split view — pestañas tipo VS Code y vista partida | 0.2.1 | complete · 34/34 AC | 003 |
| [006](006-editor-undo/spec.md) | Editor undo — pila propia de deshacer/rehacer | 0.1.3 | complete · 36/36 AC | 005 |

Cada spec se escribe cuando la anterior está aprobada, para apoyarse en contratos ya cerrados.

Estado global y lo que queda abierto: [`IMPLEMENTATION.md`](../IMPLEMENTATION.md).
