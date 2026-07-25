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

| # | Feature | Spec | Estado |
|---|---------|------|--------|
| — | _(sin especificar todavía — la planificación es el siguiente paso)_ | — | — |
