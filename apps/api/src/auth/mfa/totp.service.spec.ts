import type { ConfigService } from '@nestjs/config';

import type { AppConfig } from '../../config/env.validation';
import { TotpService } from './totp.service';

const ISSUER = 'One Markdown Test';
const EMAIL = 'persona@example.test';

/** Epoch fijo: los tests no pueden depender del reloj de la máquina que los corre. */
const EPOCH = 1_700_000_000;
/** Un paso TOTP dura 30 s; los desplazamientos de los tests se leen contra este período. */
const PERIOD = 30;

function buildService(issuer = ISSUER): TotpService {
  const config = {
    get: (): string => issuer,
  } as unknown as ConfigService<AppConfig, true>;

  return new TotpService(config);
}

describe('TotpService (AC-13, AC-17)', () => {
  const service = buildService();

  describe('generateSecret', () => {
    it('devuelve base32 sin relleno (solo A–Z y 2–7)', () => {
      expect(service.generateSecret()).toMatch(/^[A-Z2-7]+$/);
    });

    it('devuelve un secreto distinto en cada llamada', () => {
      expect(service.generateSecret()).not.toBe(service.generateSecret());
    });

    // Menos de 128 bits de entropía debilitaría el segundo factor; 20 bytes son 32 caracteres base32.
    it('tiene al menos 128 bits de entropía', () => {
      expect(service.generateSecret().length).toBeGreaterThanOrEqual(26);
    });
  });

  describe('generateCode', () => {
    it('devuelve seis dígitos', async () => {
      const secret = service.generateSecret();

      expect(await service.generateCode(secret, EPOCH)).toMatch(/^\d{6}$/);
    });

    it('es determinista para un mismo secreto y epoch', async () => {
      const secret = service.generateSecret();
      const [a, b] = await Promise.all([
        service.generateCode(secret, EPOCH),
        service.generateCode(secret, EPOCH),
      ]);

      expect(a).toBe(b);
    });

    it('cambia al pasar de paso de 30 s', async () => {
      const secret = service.generateSecret();
      const actual = await service.generateCode(secret, EPOCH);
      const siguiente = await service.generateCode(secret, EPOCH + PERIOD * 2);

      expect(siguiente).not.toBe(actual);
    });

    it('sin epoch usa el reloj y el código vale ahora mismo', async () => {
      const secret = service.generateSecret();

      await expect(service.verify(secret, await service.generateCode(secret))).resolves.toBe(true);
    });
  });

  describe('verify', () => {
    it('acepta el código del mismo secreto y epoch', async () => {
      const secret = service.generateSecret();
      const code = await service.generateCode(secret, EPOCH);

      await expect(service.verify(secret, code, EPOCH)).resolves.toBe(true);
    });

    it('rechaza el código generado con otro secreto', async () => {
      const code = await service.generateCode(service.generateSecret(), EPOCH);

      await expect(service.verify(service.generateSecret(), code, EPOCH)).resolves.toBe(false);
    });

    // Tolerancia de ±30 s: cubre el desfase de reloj del teléfono y el tiempo de teclear el código,
    // sin extender la ventana en la que un código interceptado sigue sirviendo.
    it('acepta un código de hace 25 s', async () => {
      const secret = service.generateSecret();
      const code = await service.generateCode(secret, EPOCH - 25);

      await expect(service.verify(secret, code, EPOCH)).resolves.toBe(true);
    });

    it('rechaza un código de hace 90 s', async () => {
      const secret = service.generateSecret();
      const code = await service.generateCode(secret, EPOCH - 90);

      await expect(service.verify(secret, code, EPOCH)).resolves.toBe(false);
    });

    it('rechaza un código de dentro de 90 s', async () => {
      const secret = service.generateSecret();
      const code = await service.generateCode(secret, EPOCH + 90);

      await expect(service.verify(secret, code, EPOCH)).resolves.toBe(false);
    });

    // Un código mal formado o un secreto corrupto son un fallo de credenciales, no un 500: otplib
    // lanza en estos casos y el servicio tiene que traducirlo a `false`.
    it.each(['', '12345', 'abcdef', '1234567'])('rechaza sin lanzar el código %p', async (code) => {
      await expect(service.verify(service.generateSecret(), code, EPOCH)).resolves.toBe(false);
    });

    it('rechaza sin lanzar cuando el secreto guardado no es base32 válido', async () => {
      await expect(service.verify('no-es-base32!', '123456', EPOCH)).resolves.toBe(false);
    });
  });

  describe('buildUri', () => {
    it('emite un otpauth:// de tipo totp con el issuer y el correo', () => {
      const secret = service.generateSecret();
      const uri = service.buildUri({ secret, email: EMAIL });
      const legible = decodeURIComponent(uri);

      expect(uri.startsWith('otpauth://totp/')).toBe(true);
      expect(legible).toContain(ISSUER);
      expect(legible).toContain(EMAIL);
      expect(uri).toContain(`secret=${secret}`);
    });

    it('toma el issuer de MFA_ISSUER', () => {
      const uri = buildService('Otro Issuer').buildUri({
        secret: service.generateSecret(),
        email: EMAIL,
      });

      expect(decodeURIComponent(uri)).toContain('Otro Issuer');
      expect(decodeURIComponent(uri)).not.toContain(ISSUER);
    });
  });

  describe('buildQrDataUrl', () => {
    it('devuelve un data URL de PNG', async () => {
      const uri = service.buildUri({ secret: service.generateSecret(), email: EMAIL });
      const dataUrl = await service.buildQrDataUrl(uri);

      expect(dataUrl.startsWith('data:image/png;base64,')).toBe(true);
      expect(dataUrl.length).toBeGreaterThan('data:image/png;base64,'.length);
    });
  });
});
