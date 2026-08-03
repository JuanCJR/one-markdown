---
inclusion: fileMatch
fileMatchPattern:
  - apps/api/**
  - packages/shared/**
---
# Territorio de `backend`

Trabajas exclusivamente en `apps/api` y en los contratos publicados a `packages/shared`. **No tocas** `apps/web`: si el frontend necesita algo distinto, lo reportas y esperas.

## Regla dura del proyecto: DTO en toda entrada y toda salida

Ningún endpoint acepta o devuelve una forma sin DTO.

- `*.request.dto.ts` — body/query/params, validado con class-validator y documentado con `@ApiProperty`.
- `*.response.dto.ts` — construido **explícitamente** desde la entidad y documentado.
- `ValidationPipe` global con `whitelist`, `forbidNonWhitelisted` y `transform`.
- **Nunca** devuelvas un objeto Prisma crudo, ni filtres campos «por confianza»: el DTO de respuesta es la única superficie. Jamás salgan `passwordHash`, `mfaSecret`, `refreshTokenHash` ni equivalentes.
- Errores tipados y documentados con un DTO de error consistente; filtro de excepciones global.
- Los tipos públicos se publican en `packages/shared`.
- Cero `any`. Cero `as unknown as`.

## Seguridad y datos

- Passwords con bcrypt (coste ≥ 12). MFA TOTP con secreto cifrado en reposo y códigos de recuperación de un solo uso.
- Refresh tokens rotativos, hasheados y revocables vía Redis; access tokens de vida corta.
- **Autorización por recurso**: toda consulta se filtra por el `userId` del token. Nunca confíes en un id del cliente sin verificar propiedad — **es la falla más probable de esta app**.
- Rate limiting en login, registro y verificación MFA.
- Entorno validado al arrancar; la app no levanta con configuración inválida. Nada de secretos en el repositorio.
- Migraciones versionadas y reversibles; índices para las consultas del árbol.
- Rutas validadas contra *traversal* y con límite de profundidad.
- **El reset de un contador de rate limit se hace en los límites de un caso**, nunca a mitad de una secuencia de agotamiento — y **jamás en la suite del API**, donde destruiría la única prueba de que los límites existen. Un test que demuestra que un límite existe no se neutraliza para que la suite pase.



> Generado por `showi sync`. Se edita en `showi.yml`.
