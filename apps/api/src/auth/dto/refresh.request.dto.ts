/**
 * Cuerpo de `POST /api/auth/refresh` y `POST /api/auth/logout`: **vacío**.
 *
 * La credencial viaja en la cookie `HttpOnly`, no en el cuerpo. La clase existe igualmente para que
 * el `ValidationPipe` global se aplique: sin un DTO declarado, el pipe no se activa y un cuerpo
 * inesperado se ignoraría en silencio. Al no tener ninguna propiedad, `whitelist` +
 * `forbidNonWhitelisted` rechazan con `400` cualquier campo que llegue (`plan.md` §3).
 */
export class RefreshRequestDto {}
