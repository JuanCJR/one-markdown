import { validateEnv } from './env.validation';

const SECRET_A = 'a'.repeat(32);
const SECRET_B = 'b'.repeat(32);
/** 32 bytes exactos en base64: la longitud que exige AES-256-GCM. */
const MFA_KEY = Buffer.alloc(32, 7).toString('base64');

function validEnv(): Record<string, string> {
  return {
    NODE_ENV: 'test',
    DATABASE_URL: 'postgresql://one_markdown:one_markdown@localhost:5433/one_markdown',
    REDIS_URL: 'redis://localhost:6379',
    JWT_ACCESS_SECRET: SECRET_A,
    JWT_REFRESH_SECRET: SECRET_B,
    MFA_ENCRYPTION_KEY: MFA_KEY,
  };
}

function withoutKey(key: string): Record<string, string> {
  const env = validEnv();
  delete env[key];
  return env;
}

describe('validateEnv', () => {
  describe('variables requeridas ausentes (AC-6, AC-26)', () => {
    it.each([
      'DATABASE_URL',
      'REDIS_URL',
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'MFA_ENCRYPTION_KEY',
    ])('falla nombrando %s cuando falta', (key) => {
      expect(() => validateEnv(withoutKey(key))).toThrow(new RegExp(key));
    });

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

  // AC-26: una clave que no sirva para AES-256-GCM tiene que delatarse en el bootstrap, no al
  // cifrar el primer secreto TOTP de un usuario real.
  describe('MFA_ENCRYPTION_KEY (AC-26)', () => {
    it('rechaza una clave que decodifica a menos de 32 bytes', () => {
      const key16 = Buffer.alloc(16, 7).toString('base64');

      expect(() => validateEnv({ ...validEnv(), MFA_ENCRYPTION_KEY: key16 })).toThrow(
        /MFA_ENCRYPTION_KEY/,
      );
    });

    it('rechaza una clave que decodifica a más de 32 bytes', () => {
      const key64 = Buffer.alloc(64, 7).toString('base64');

      expect(() => validateEnv({ ...validEnv(), MFA_ENCRYPTION_KEY: key64 })).toThrow(
        /MFA_ENCRYPTION_KEY/,
      );
    });

    it('rechaza una clave que no es base64', () => {
      expect(() =>
        validateEnv({ ...validEnv(), MFA_ENCRYPTION_KEY: 'esto-no-es-base64!!' }),
      ).toThrow(/MFA_ENCRYPTION_KEY/);
    });

    it('acepta 32 bytes exactos y los expone tal cual', () => {
      expect(validateEnv(validEnv()).MFA_ENCRYPTION_KEY).toBe(MFA_KEY);
    });
  });

  describe('TTLs y coste de bcrypt', () => {
    it.each([
      ['JWT_ACCESS_TTL', '59'],
      ['JWT_ACCESS_TTL', '3601'],
      ['JWT_ACCESS_TTL', 'quince-minutos'],
      ['JWT_REFRESH_TTL', '3599'],
      ['JWT_REFRESH_TTL', '2592001'],
      ['BCRYPT_ROUNDS', '3'],
      ['BCRYPT_ROUNDS', '16'],
      ['BCRYPT_ROUNDS', 'doce'],
    ])('rechaza %s con valor %s', (key, value) => {
      expect(() => validateEnv({ ...validEnv(), [key]: value })).toThrow(new RegExp(key));
    });

    // Misma convención que PORT y WEB_ORIGIN en este archivo: un valor vacío se trata como ausente.
    // No es un secreto, y sustituir el default evita que un `MFA_ISSUER=` a medias genere un
    // otpauth:// sin issuer en la app de autenticación del usuario.
    it('trata MFA_ISSUER vacío como ausente y usa el default', () => {
      expect(validateEnv({ ...validEnv(), MFA_ISSUER: '' }).MFA_ISSUER).toBe('One Markdown');
    });

    it('rechaza MFA_ISSUER de más de 64 caracteres', () => {
      expect(() => validateEnv({ ...validEnv(), MFA_ISSUER: 'x'.repeat(65) })).toThrow(
        /MFA_ISSUER/,
      );
    });

    it('convierte los TTLs y el coste a número cuando vienen definidos', () => {
      const config = validateEnv({
        ...validEnv(),
        JWT_ACCESS_TTL: '600',
        JWT_REFRESH_TTL: '86400',
        BCRYPT_ROUNDS: '4',
      });

      expect(config.JWT_ACCESS_TTL).toBe(600);
      expect(config.JWT_REFRESH_TTL).toBe(86400);
      expect(config.BCRYPT_ROUNDS).toBe(4);
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

    it('aplica los defaults de auth cuando no vienen definidos', () => {
      const config = validateEnv(validEnv());

      expect(config.JWT_ACCESS_TTL).toBe(900);
      expect(config.JWT_REFRESH_TTL).toBe(604800);
      expect(config.BCRYPT_ROUNDS).toBe(12);
      expect(config.MFA_ISSUER).toBe('One Markdown');
    });

    it('ignora variables ajenas del entorno sin fallar', () => {
      expect(() => validateEnv({ ...validEnv(), HOME: '/home/dev', PATH: '/usr/bin' })).not.toThrow();
    });
  });
});
