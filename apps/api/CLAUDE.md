# Reglas del backend (apps/api)

## DTOs (regla dura)

Toda entrada y toda salida de cada endpoint pasa por un DTO explícito: `*.request.dto.ts` validado con class-validator y `*.response.dto.ts` construido explícitamente, ambos documentados con Swagger. Nunca se devuelve una entidad Prisma cruda. `ValidationPipe` global con `whitelist` + `forbidNonWhitelisted`. Cero `any`.
