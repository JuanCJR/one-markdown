import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginAttemptService } from './login-attempt.service';
import { PasswordService } from './password.service';
import { SessionStore } from './session.store';
import { TokenService } from './token.service';

/**
 * Módulo de auth autocontenido (specs/001-auth/plan.md §2 decisión 11).
 *
 * `JwtModule.register({})` sin secreto a propósito: `TokenService` pasa el secreto y el TTL en cada
 * firma porque access, refresh y `mfaToken` no comparten configuración.
 *
 * Se exportan `JwtAuthGuard` y los servicios que la spec `002` y el submódulo de MFA necesitan; el
 * decorador `@CurrentUser()` no es un provider y se importa desde el índice del módulo.
 */
@Module({
  imports: [JwtModule.register({}), PassportModule],
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionStore,
    LoginAttemptService,
    JwtAccessStrategy,
    JwtAuthGuard,
  ],
  exports: [AuthService, PasswordService, TokenService, SessionStore, JwtAuthGuard],
})
export class AuthModule {}
