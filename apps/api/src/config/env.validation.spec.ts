import { validateEnv } from './env.validation';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://one_markdown:one_markdown@localhost:5433/one_markdown',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: SECRET_A,
    JWT_REFRESH_SECRET: SECRET_B,
  };
}

function withoutKey(key: string): Record<string, string> {
  const env = validEnv();
  delete env[key];
  return env;
}

describe('validateEnv', () => {
  describe('variables requeridas ausentes (AC-6)', () => {
    it.each(['DATABASE_URL', 'REDIS_URL', 'JWT_ACCESS_SECRET', 'JWT_REFRESH_SECRET'])(
      'falla nombrando %s cuando falta',
      (key) => {
        expect(() => validateEnv(withoutKey(key))).toThrow(new RegExp(key));
      },
    );

    it('falla nombrando NODE_ENV cuando falta', () => {
      expect(() => validateEnv(withoutKey('NODE_ENV'))).toThrow(/NODE_ENV/);
    });
  });

  describe('valores inválidos', () => {
    it('rechaza NODE_ENV fuera del conjunto permitido', () => {
      expect(() => validateEnv({ ...validEnv(), NODE_ENV: 'staging' })).toThrow(/NODE_ENV/);
    });

    it('rechaza secretos de menos de 32 caracteres', () => {
      expect(() => validateEnv({ ...validEnv(), JWT_ACCESS_SECRET: 'corto' })).toThrow(
        /JWT_ACCESS_SECRET/,
      );
    });

    it('rechaza que el secreto de refresh sea igual al de access', () => {
      expect(() =>
        validateEnv({ ...validEnv(), JWT_REFRESH_SECRET: SECRET_A }),
      ).toThrow(/JWT_REFRESH_SECRET/);
    });

    it('rechaza DATABASE_URL que no sea postgresql://', () => {
      expect(() => validateEnv({ ...validEnv(), DATABASE_URL: 'mysql://localhost/db' })).toThrow(
        /DATABASE_URL/,
      );
    });

    it('rechaza REDIS_URL que no sea redis://', () => {
      expect(() => validateEnv({ ...validEnv(), REDIS_URL: 'http://localhost:6379' })).toThrow(
        /REDIS_URL/,
      );
    });

    it('rechaza PORT no numérico', () => {
      expect(() => validateEnv({ ...validEnv(), PORT: 'ochenta' })).toThrow(/PORT/);
    });

    it('rechaza PORT fuera de rango', () => {
      expect(() => validateEnv({ ...validEnv(), PORT: '70000' })).toThrow(/PORT/);
    });
  });

  describe('entorno válido', () => {
    it('devuelve la configuración tipada con PORT por defecto en 3001', () => {
      const config = validateEnv(validEnv());

      expect(config.NODE_ENV).toBe('test');
      expect(config.PORT).toBe(3001);
      expect(config.DATABASE_URL).toContain('postgresql://');
      expect(config.JWT_ACCESS_SECRET).toBe(SECRET_A);
    });

    it('convierte PORT a número cuando viene definido', () => {
      const config = validateEnv({ ...validEnv(), PORT: '4001' });

      expect(config.PORT).toBe(4001);
    });

    it('usa http://localhost:5173 como WEB_ORIGIN por defecto', () => {
      expect(validateEnv(validEnv()).WEB_ORIGIN).toBe('http://localhost:5173');
    });

    it('ignora variables ajenas del entorno sin fallar', () => {
      expect(() => validateEnv({ ...validEnv(), HOME: '/home/dev', PATH: '/usr/bin' })).not.toThrow();
    });
  });
});
