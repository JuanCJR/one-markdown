import type { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import type { AppConfig } from '../config/env.validation';
import { PasswordService } from './password.service';

// `jest.spyOn(bcrypt, 'compare')` falla con `Cannot redefine property`: los exports de bcrypt no son
// reconfigurables. Se envuelve el módulo real en un mock que **delega en la implementación auténtica**,
// así los tests siguen ejecutando bcrypt de verdad y además se pueden observar las llamadas.
jest.mock('bcrypt', () => {
  const actual = jest.requireActual<typeof import('bcrypt')>('bcrypt');

  return { ...actual, compare: jest.fn(actual.compare) };
});

const compareMock = bcrypt.compare as jest.MockedFunction<typeof bcrypt.compare>;

/** Config mínima: al servicio solo le interesa `BCRYPT_ROUNDS`. */
function serviceWithRounds(rounds: number): PasswordService {
  const config = {
    get: (): number => rounds,
  } as unknown as ConfigService<AppConfig, true>;

  return new PasswordService(config);
}

describe('PasswordService (AC-4)', () => {
  // Coste 4 salvo donde el test verifique explícitamente el coste real de producción: con 12,
  // cada hash cuesta ~250 ms y la suite se vuelve inusable.
  const service = serviceWithRounds(4);
  const password = 'contrasena-de-prueba-1';

  describe('hash', () => {
    it('devuelve un hash bcrypt distinto del texto original', async () => {
      const hash = await service.hash(password);

      expect(hash).toMatch(/^\$2b\$/);
      expect(hash).not.toBe(password);
      expect(hash).not.toContain(password);
    });

    it('produce hashes distintos para la misma contraseña (salt aleatorio)', async () => {
      const [a, b] = await Promise.all([service.hash(password), service.hash(password)]);

      expect(a).not.toBe(b);
    });

    it('usa el coste de BCRYPT_ROUNDS', async () => {
      expect(await serviceWithRounds(4).hash(password)).toMatch(/^\$2b\$04\$/);
    });

    // El coste de producción se verifica una sola vez y a propósito: es el que protege de verdad
    // ante una filtración de la base, y un default cambiado por accidente pasaría inadvertido.
    it('con el default de producción (12) emite un hash de coste 12', async () => {
      expect(await serviceWithRounds(12).hash(password)).toMatch(/^\$2b\$12\$/);
    }, 15000);
  });

  describe('compare', () => {
    it('acepta la contraseña correcta', async () => {
      const hash = await service.hash(password);

      await expect(service.compare(password, hash)).resolves.toBe(true);
    });

    it('rechaza una contraseña distinta', async () => {
      const hash = await service.hash(password);

      await expect(service.compare('otra-contrasena-larga', hash)).resolves.toBe(false);
    });

    it('rechaza sin lanzar cuando el hash guardado está corrupto', async () => {
      await expect(service.compare(password, 'no-es-un-hash')).resolves.toBe(false);
    });
  });

  // Decisión 9 de plan.md: sin esto, un correo inexistente responde antes que uno existente y el
  // tiempo de respuesta delata qué cuentas hay, justo lo que AC-6 evita en el cuerpo de la respuesta.
  describe('compareWithDecoy', () => {
    beforeEach(() => {
      compareMock.mockClear();
    });

    it('devuelve false', async () => {
      await expect(service.compareWithDecoy(password)).resolves.toBe(false);
    });

    it('ejecuta una comparación bcrypt real, no un cortocircuito', async () => {
      await service.compareWithDecoy(password);

      expect(compareMock).toHaveBeenCalledTimes(1);
    });

    it('compara contra un hash señuelo, nunca contra la contraseña recibida', async () => {
      await service.compareWithDecoy(password);

      const hashUsado = compareMock.mock.calls[0]?.[1];
      expect(hashUsado).toMatch(/^\$2b\$/);
      expect(hashUsado).not.toContain(password);
    });
  });
});
