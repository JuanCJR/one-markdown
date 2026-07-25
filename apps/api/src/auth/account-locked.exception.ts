import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Cuenta bloqueada temporalmente por intentos fallidos (AC-7).
 *
 * Lleva `retryAfterSeconds` fuera del cuerpo además de dentro: el filtro global lo usa para la
 * cabecera `Retry-After`, y el usuario legítimo que se equivocó cinco veces necesita saber cuánto
 * esperar, no solo que se le negó el paso.
 */
export class AccountLockedException extends HttpException {
  readonly retryAfterSeconds: number;

  constructor(retryAfterSeconds: number) {
    super(
      {
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
        error: 'Too Many Requests',
        message: 'Demasiados intentos fallidos. Vuelve a intentarlo más tarde.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );

    this.retryAfterSeconds = retryAfterSeconds;
  }
}
