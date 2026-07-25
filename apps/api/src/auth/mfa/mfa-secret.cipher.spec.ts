import { randomBytes } from 'node:crypto';

import type { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { MfaSecretCipher } from './mfa-secret.cipher';

/** 32 bytes en base64: exactamente lo que `validateEnv` exige para `MFA_ENCRYPTION_KEY` (plan §4). */
const KEY = randomBytes(32).toString('base64');
const OTRA_KEY = randomBytes(32).toString('base64');

/** Un secreto TOTP real es base32; el cifrador no lo interpreta, pero conviene probar con la forma real. */
const SECRETO = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';

function cipherConClave(key: string): MfaSecretCipher {
  const config = {
    get: (): string => key,
  } as unknown as ConfigService<AppConfig, true>;

  return new MfaSecretCipher(config);
}

/**
 * Invierte un bit de un byte **real** de una de las tres partes.
 *
 * No vale cambiar el último carácter base64url: cuando la longitud en bytes no es múltiplo de 3 (el
 * tag son 16 y el texto cifrado 32), los bits bajos de ese carácter son relleno que
 * `Buffer.from(…, 'base64url')` descarta. La parte "alterada" decodificaba entonces a los **mismos**
 * bytes, GCM la aceptaba y el test fallaba una de cada ocho veces.
 */
function alterarParte(cifrado: string, indiceParte: number): string {
  const partes = cifrado.split('.');
  const bytes = Buffer.from(partes[indiceParte] ?? '', 'base64url');
  const ultimo = bytes.byteLength - 1;

  bytes.writeUInt8(bytes.readUInt8(ultimo) ^ 1, ultimo);
  partes[indiceParte] = bytes.toString('base64url');

  return partes.join('.');
}

describe('MfaSecretCipher (AC-14)', () => {
  const cipher = cipherConClave(KEY);

  describe('construcción', () => {
    it('lanza si la clave decodifica a menos de 32 bytes', () => {
      expect(() => cipherConClave(randomBytes(16).toString('base64'))).toThrow(
        /MFA_ENCRYPTION_KEY/,
      );
    });

    it('lanza si la clave decodifica a más de 32 bytes', () => {
      expect(() => cipherConClave(randomBytes(48).toString('base64'))).toThrow(
        /MFA_ENCRYPTION_KEY/,
      );
    });

    it('acepta una clave de exactamente 32 bytes', () => {
      expect(() => cipherConClave(KEY)).not.toThrow();
    });
  });

  describe('encrypt', () => {
    it('devuelve un texto que no contiene el secreto', () => {
      const cifrado = cipher.encrypt(SECRETO);

      expect(cifrado).not.toContain(SECRETO);
      expect(cifrado).not.toBe(SECRETO);
    });

    it('emite tres partes base64url separadas por punto (iv.tag.ciphertext)', () => {
      const partes = cipher.encrypt(SECRETO).split('.');

      expect(partes).toHaveLength(3);

      for (const parte of partes) {
        expect(parte).toMatch(/^[A-Za-z0-9_-]+$/);
      }

      // 12 bytes de IV y 16 de tag GCM en base64url, sin relleno.
      expect(Buffer.from(partes[0] ?? '', 'base64url')).toHaveLength(12);
      expect(Buffer.from(partes[1] ?? '', 'base64url')).toHaveLength(16);
    });

    // Sin IV aleatorio, dos usuarios con el mismo secreto tendrían la misma fila y un dump de la base
    // permitiría agruparlos; además AES-GCM con IV repetido es catastrófico.
    it('produce textos distintos para el mismo secreto (IV aleatorio)', () => {
      expect(cipher.encrypt(SECRETO)).not.toBe(cipher.encrypt(SECRETO));
    });
  });

  describe('decrypt', () => {
    it('recupera el secreto original', () => {
      expect(cipher.decrypt(cipher.encrypt(SECRETO))).toBe(SECRETO);
    });

    it('recupera secretos cifrados por otra instancia con la misma clave', () => {
      const cifrado = cipherConClave(KEY).encrypt(SECRETO);

      expect(cipherConClave(KEY).decrypt(cifrado)).toBe(SECRETO);
    });

    it.each([
      ['el iv', 0],
      ['el tag', 1],
      ['el texto cifrado', 2],
    ])('falla si se altera %s (autenticación GCM)', (_parte, indice) => {
      const alterado = alterarParte(cipher.encrypt(SECRETO), indice);

      expect(() => cipher.decrypt(alterado)).toThrow();
    });

    it('falla con una clave distinta a la que cifró', () => {
      const cifrado = cipher.encrypt(SECRETO);

      expect(() => cipherConClave(OTRA_KEY).decrypt(cifrado)).toThrow();
    });

    it.each(['', 'sin-puntos', 'a.b', 'a.b.c.d'])(
      'falla si el formato no es iv.tag.ciphertext (%p)',
      (valor) => {
        expect(() => cipher.decrypt(valor)).toThrow();
      },
    );

    it('no incluye el secreto ni la clave en el mensaje de error', () => {
      const alterado = alterarParte(cipher.encrypt(SECRETO), 2);

      try {
        cipher.decrypt(alterado);
        throw new Error('se esperaba que decrypt lanzara');
      } catch (error) {
        const mensaje = error instanceof Error ? error.message : String(error);

        expect(mensaje).not.toContain(SECRETO);
        expect(mensaje).not.toContain(KEY);
      }
    });
  });
});
