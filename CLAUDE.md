# One Markdown

App web para gestionar archivos markdown organizados en categorías/directorios y subdirectorios: crear, editar, eliminar y visualizar. Visualización en modo texto o preview, paleta de elementos markdown para usuarios que no dominan la sintaxis, tabs tipo VS Code al abrir documentos y **split view: texto y preview lado a lado del mismo documento** (no dos documentos distintos).

## Agentes

Cualquier feature o cambio significativo entra por el agente `orchestrator`, dueño de `specs/**` e `IMPLEMENTATION.md` (nadie más los edita). Los agentes de implementación (`frontend` → `apps/web`, `backend` → `apps/api`) solo ejecutan tareas `T-NNN` ya especificadas, en TDD.

## Metodología

**El método vive en las skills, no en este archivo.** Aquí solo está dónde aplica; el qué y el porqué se cargan desde `.claude/skills/`, que es lo que hace el montaje trasladable a otro proyecto y a otra herramienta.

| Skill | Qué posee |
|---|---|
| `spec-driven-development` | Nada se implementa sin spec en `specs/NNN-slug/`. Documentos, versionado semántico, reglas de redacción. |
| `test-driven-development-tdd` | RED → GREEN → REFACTOR, la regla del andamio, la anatomía de una tarea `T-NNN` y el radio de un cambio. |
| `stop-and-report` | Los seis casos en que un agente para y avisa en vez de arreglarlo, y qué hace quien recibe el reporte. |
| `verification-and-measurement` | Cómo se verifica y cómo no creerse un cero falso. |

**Si una de las cuatro no está disponible, se para y se avisa** — no se reconstruye de memoria.

Lo único de metodología que es de este repositorio y no de las skills: **`IMPLEMENTATION.md` se actualiza solo tras verificar** (comando corrido + salida real), con `[ ]` pendiente · `[~]` en curso o bloqueado con motivo · `[x]` hecho y verificado. El detalle histórico de cada feature va a su `CHANGELOG`, no aquí.

## Reglas de código

- TypeScript estricto en todos los paquetes.
- Autorización por recurso: todo acceso a documentos/directorios se filtra por el `userId` del token.
- El backend es el dueño del auth (JWT access+refresh, bcrypt, MFA TOTP, Passport, Redis). Auth.js está fuera de alcance.
- Preview de markdown siempre sanitizado.
- Secretos solo por variables de entorno validadas al arrancar; nada en el repo.
