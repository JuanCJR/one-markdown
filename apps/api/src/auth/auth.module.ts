import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAccessStrategy } from './jwt-access.strategy';
import { JwtAuthGuard } from './jwt-auth.guard';
import { LoginAttemptService } from './login-attempt.service';
import { MfaChallengeStore } from './mfa/mfa-challenge.store';
import { MfaSecretCipher } from './mfa/mfa-secret.cipher';
import { MfaSetupStore } from './mfa/mfa-setup.store';
import { MfaController } from './mfa/mfa.controller';
import { MfaService } from './mfa/mfa.service';
import { RecoveryCodeService } from './mfa/recovery-code.service';
import { TotpService } from './mfa/totp.service';
import { PasswordService } from './password.service';
import { SessionStore } from './session.store';
import { TokenService } from './token.service';

/**
 * Módulo de auth autocontenido (specs/001-auth/plan.md §2 decisión 11).
 *
 * `JwtModule.register({})` sin secreto a propósito: `TokenService` pasa el secreto y el TTL en cada
 * firma porque access, refresh y `mfaToken` no comparten configuración.
 *
 * El segundo factor vive en `./mfa/` y se registra aquí en vez de en un `MfaModule` propio: comparte
 * `PasswordService`, `TokenService`, `SessionStore` y `AuthService.issueSession()` con el resto del
 * auth, y un módulo separado solo añadiría `imports`/`exports` cruzados sin aislar nada.
 *
 * Se exportan `JwtAuthGuard` y los servicios que la spec `002` necesita; el decorador
 * `@CurrentUser()` no es un provider y se importa desde el índice del módulo.
 */
@Module({
  imports: [JwtModule.register({}), PassportModule],
  controllers: [AuthController, MfaController],
  providers: [
    AuthService,
    PasswordService,
    TokenService,
    SessionStore,
    LoginAttemptService,
    JwtAccessStrategy,
    JwtAuthGuard,
    MfaSecretCipher,
    TotpService,
    MfaSetupStore,
    MfaChallengeStore,
    RecoveryCodeService,
    MfaService,
  ],
  exports: [AuthService, PasswordService, TokenService, SessionStore, JwtAuthGuard],
})
export class AuthModule {}
