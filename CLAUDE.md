# One Markdown

App web para gestionar archivos markdown organizados en categorías/directorios y subdirectorios: crear, editar, eliminar y visualizar. Visualización en modo texto o preview, paleta de elementos markdown para usuarios que no dominan la sintaxis, tabs tipo VS Code al abrir documentos y **split view: texto y preview lado a lado del mismo documento** (no dos documentos distintos).

## Agentes

Cualquier feature o cambio significativo entra por el agente `orchestrator`, dueño de `specs/**` e `IMPLEMENTATION.md` (nadie más los edita). Los agentes de implementación (`frontend` → `apps/web`, `backend` → `apps/api`) solo ejecutan tareas `T-NNN` ya especificadas, en TDD.

## Metodología

- **SDD**: nada se implementa sin spec en `specs/NNN-slug/` (`spec.md` + `plan.md` + `tasks.md` + `CHANGELOG.md`), una carpeta por feature. La spec se versiona semánticamente; cada cambio deja entrada en su CHANGELOG.
- **TDD**: RED → GREEN → REFACTOR. El test se escribe primero y debe fallar antes de implementar. Cada criterio de aceptación (`AC-N`) tiene al menos un test automatizado.
- **Seguimiento**: `IMPLEMENTATION.md` se actualiza solo tras verificar (comando corrido + salida real). `[ ]` pendiente · `[~]` en curso/bloqueado con motivo · `[x]` hecho y verificado.

## Reglas de código

- TypeScript estricto en todos los paquetes.
- Autorización por recurso: todo acceso a documentos/directorios se filtra por el `userId` del token.
- El backend es el dueño del auth (JWT access+refresh, bcrypt, MFA TOTP, Passport, Redis). Auth.js está fuera de alcance.
- Preview de markdown siempre sanitizado.
- Secretos solo por variables de entorno validadas al arrancar; nada en el repo.
