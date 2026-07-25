import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';

const ALGORITHM = 'aes-256-gcm';
/** AES-256: la clave es de 32 bytes, ni uno más ni uno menos. */
const KEY_BYTES = 32;
/** 96 bits es el tamaño de IV recomendado para GCM: es el que no requiere derivación extra. */
const IV_BYTES = 12;
const TAG_BYTES = 16;
const SEPARATOR = '.';
const PARTS = 3;

/**
 * Cifra el secreto TOTP que se guarda en `users.mfaSecret` (decisión 6 de specs/001-auth/plan.md).
 *
 * GCM y no CBC: además de confidencialidad da autenticación, así que una fila manipulada en la base
 * falla al descifrar en vez de producir un secreto distinto con el que nadie podría entrar nunca.
 *
 * Formato `iv.tag.ciphertext` en base64url: las tres partes son necesarias para descifrar y el
 * alfabeto base64url no usa `.`, así que el separador nunca aparece dentro de una parte.
 */
@Injectable()
export class MfaSecretCipher {
  private readonly key: Buffer;

  constructor(config: ConfigService<AppConfig, true>) {
    const key = Buffer.from(config.get('MFA_ENCRYPTION_KEY', { infer: true }), 'base64');

    // `validateEnv` ya lo comprueba al arrancar, pero el servicio también se construye en tests y
    // scripts que no pasan por el bootstrap: sin esta guarda, una clave corta reventaría dentro de
    // OpenSSL al cifrar el primer secreto y no al inicializar.
    if (key.byteLength !== KEY_BYTES) {
      throw new Error(
        `MFA_ENCRYPTION_KEY debe decodificar a exactamente ${String(KEY_BYTES)} bytes (tiene ${String(key.byteLength)})`,
      );
    }

    this.key = key;
  }

  encrypt(plain: string): string {
    const iv = randomBytes(IV_BYTES);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const ciphertext = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);

    return [iv, cipher.getAuthTag(), ciphertext]
      .map((part) => part.toString('base64url'))
      .join(SEPARATOR);
  }

  /**
   * Cualquier fallo (formato, longitudes, tag inválido) sale como el **mismo** error y sin incluir el
   * dato de entrada: quien manipule la base no debe aprender en qué byte se equivocó.
   */
  decrypt(payload: string): string {
    const parts = payload.split(SEPARATOR);

    if (parts.length !== PARTS) {
      throw new Error('No se pudo descifrar el secreto MFA');
    }

    const [ivPart, tagPart, ciphertextPart] = parts;
    const iv = Buffer.from(ivPart ?? '', 'base64url');
    const tag = Buffer.from(tagPart ?? '', 'base64url');
    const ciphertext = Buffer.from(ciphertextPart ?? '', 'base64url');

    if (iv.byteLength !== IV_BYTES || tag.byteLength !== TAG_BYTES) {
      throw new Error('No se pudo descifrar el secreto MFA');
    }

    try {
      const decipher = createDecipheriv(ALGORITHM, this.key, iv);
      decipher.setAuthTag(tag);

      return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
    } catch {
      throw new Error('No se pudo descifrar el secreto MFA');
    }
  }
}
