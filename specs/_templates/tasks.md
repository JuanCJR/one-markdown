# Tareas NNN — <título de la feature>

Spec: `spec.md` v<x.y.z> · Plan: `plan.md`

Cada tarea es atómica, se asigna a un agente y sigue RED → GREEN → REFACTOR.
El test se escribe primero y **debe fallar antes** de implementar.

- [ ] **T-001** · `backend` · <título>
      **AC**: AC-1
      **Depende de**: —
      **RED**: <test que debe fallar y su archivo>
      **GREEN**: <implementación mínima esperada>
      **DONE**: `pnpm --filter @one-markdown/api test <patrón>`

- [ ] **T-002** · `frontend` · <título>
      **AC**: AC-2, AC-3
      **Depende de**: T-001
      **RED**: <test que debe fallar y su archivo>
      **GREEN**: <implementación mínima esperada>
      **DONE**: `pnpm --filter @one-markdown/web test <patrón>`

## Definition of Done (todas las tareas)

1. El test se escribió primero y falló primero (reportado por el agente).
2. Cada AC de la spec tiene al menos un test automatizado.
3. Backend: entrada y salida con DTO validado y documentado en Swagger; sin entidades Prisma crudas; sin `any`.
4. `pnpm typecheck`, `pnpm lint` y `pnpm test` pasan.
5. `IMPLEMENTATION.md` actualizado por el orchestrator con el comando de verificación y su resultado.
