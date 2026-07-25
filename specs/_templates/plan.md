# Plan NNN — <título de la feature>

Spec de referencia: `spec.md` v<x.y.z>

## 1. Decisiones de arquitectura

| # | Decisión | Alternativas descartadas | Motivo |
|---|----------|--------------------------|--------|
| 1 | | | |

## 2. Contrato de API

Una tabla por endpoint. **Toda entrada y toda salida tiene DTO.**

### `<MÉTODO> /<ruta>`

- **Auth**: requerida / pública · **Rol/propiedad**: <regla de autorización por recurso>
- **Request DTO**: `<Nombre>RequestDto` — campos, tipos y validaciones (class-validator)
- **Response DTO**: `<Nombre>ResponseDto` — campos y tipos exactos que salen al cliente
- **Errores**: `400` <cuándo> · `401` <cuándo> · `403` <cuándo> · `404` <cuándo> · `409` <cuándo>

## 3. Esquema / migración Prisma

```prisma
// modelos nuevos o modificados
```

Índices y restricciones: <…>
Nombre de la migración: `<yyyymmdd>_<slug>`

## 4. Frontend

- **Rutas**: <React Router>
- **Stores Zustand**: <slice, estado, acciones, qué persiste>
- **Componentes**: <árbol de componentes y responsabilidad de cada uno>
- **Tipos compartidos**: <qué se consume de `packages/shared`>
- **Accesibilidad**: <roles, navegación por teclado, focus>

## 5. Estrategia de tests

| Nivel | Qué cubre | Dónde |
|-------|-----------|-------|
| unit (api) | | `apps/api/src/**/*.spec.ts` |
| e2e (api) | | `apps/api/test/*.e2e-spec.ts` |
| unit/componente (web) | | `apps/web/src/**/*.test.tsx` |
| e2e (web) | | `apps/web/e2e/*.spec.ts` |

## 6. Orden de ejecución

Esquema/migración → DTOs y contratos → backend → cliente API → estado → UI → e2e.
