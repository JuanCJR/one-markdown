/**
 * Índice público del módulo de auth.
 *
 * Lo que la spec `002-workspace-tree` necesita para autorización por recurso está aquí y solo aquí:
 * el guard, el decorador y el tipo del usuario autenticado. Todo lo demás (servicios, DTOs, store de
 * sesiones) es interno de `src/auth/`.
 */
export { AuthModule } from './auth.module';
export type { AuthenticatedUser } from './authenticated-user';
export { CurrentUser } from './current-user.decorator';
export { JwtAuthGuard } from './jwt-auth.guard';
export { UserResponseDto } from './dto/user.response.dto';
