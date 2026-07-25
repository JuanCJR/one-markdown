import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OTP } from 'otplib';
import { toDataURL } from 'qrcode';

import type { AppConfig } from '../../config/env.validation';

/**
 * Tolerancia de reloj **en segundos** (no en ventanas: la API 13.x de otplib razona en segundos).
 * ±30 s cubre el desfase del teléfono y el tiempo de teclear, sin alargar la vida de un código
 * interceptado más de un paso.
 */
const TOLERANCE_SECONDS = 30;
/** 20 bytes → 32 caracteres base32: el tamaño que recomienda la RFC 4226 para HMAC-SHA1. */
const SECRET_BYTES = 20;
const QR_WIDTH = 256;

/**
 * TOTP de segundo factor sobre otplib 13 (`new OTP({ strategy: 'totp' })`: `generate` y `verify` son
 * asíncronos y `verify` devuelve un `VerifyResult`, no un booleano).
 *
 * El `epoch` es un parámetro opcional en `generateCode` y `verify` para que los tests y los e2e fijen
 * el instante en vez de depender del reloj de la máquina que los corre.
 */
@Injectable()
export class TotpService {
  private readonly otp = new OTP({ strategy: 'totp' });
  private readonly issuer: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.issuer = config.get('MFA_ISSUER', { infer: true });
  }

  /** Base32 sin relleno: es lo que esperan las apps de autenticación y el parámetro `secret` del URI. */
  generateSecret(): string {
    return this.otp.generateSecret(SECRET_BYTES);
  }

  async generateCode(secret: string, epoch?: number): Promise<string> {
    // Spread condicional y no `epoch: undefined`: con `exactOptionalPropertyTypes` un `undefined`
    // explícito no es asignable a una propiedad opcional.
    return this.otp.generate({ secret, ...(epoch === undefined ? {} : { epoch }) });
  }

  /**
   * `false` en vez de excepción ante un código mal formado o un secreto corrupto: otplib lanza en esos
   * casos y un segundo factor que falla debe responder "no válido", no un 500 que además distinguiría
   * un código mal escrito de uno incorrecto.
   */
  async verify(secret: string, code: string, epoch?: number): Promise<boolean> {
    try {
      const result = await this.otp.verify({
        secret,
        token: code,
        epochTolerance: TOLERANCE_SECONDS,
        ...(epoch === undefined ? {} : { epoch }),
      });

      return result.valid;
    } catch {
      return false;
    }
  }

  /** `otpauth://totp/{issuer}:{email}?secret=…&issuer=…`, lo que se codifica en el QR (AC-13). */
  buildUri(params: { secret: string; email: string }): string {
    return this.otp.generateURI({
      issuer: this.issuer,
      label: params.email,
      secret: params.secret,
    });
  }

  async buildQrDataUrl(uri: string): Promise<string> {
    return toDataURL(uri, { errorCorrectionLevel: 'M', margin: 1, width: QR_WIDTH });
  }
}
