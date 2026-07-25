import { plainToInstance, Transform, type TransformFnParams } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsString,
  Length,
  Matches,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

// 3001 y no 3000: el 3000 es el puerto más disputado de cualquier máquina de desarrollo.
const DEFAULT_PORT = 3001;
const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';
const MIN_SECRET_LENGTH = 32;

// Auth (spec 001, plan §4). Los TTL van en segundos.
const DEFAULT_ACCESS_TTL = 900; // 15 min: ventana en la que un access token robado sigue sirviendo
const DEFAULT_REFRESH_TTL = 604800; // 7 días
const DEFAULT_BCRYPT_ROUNDS = 12;
const DEFAULT_MFA_ISSUER = 'One Markdown';
/** AES-256-GCM: la clave tiene que ser de 32 bytes, ni uno más ni uno menos. */
const MFA_KEY_BYTES = 32;
const BASE64_PATTERN = /^[A-Za-z0-9+/]+={0,2}$/;

/** Un valor ausente o vacío toma el default; cualquier otra cosa se convierte y se valida. */
function numberOrDefault(defaultValue: number) {
  return ({ value }: TransformFnParams): number =>
    value === undefined || value === '' ? defaultValue : Number(value);
}

function stringOrDefault(defaultValue: string) {
  return ({ value }: TransformFnParams): string =>
    value === undefined || value === '' ? defaultValue : String(value);
}

/** Los mensajes nombran siempre la variable: el operador tiene que saber cuál arreglar (AC-6). */
class EnvironmentVariables {
  @IsIn(NODE_ENVS, { message: `NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}` })
  NODE_ENV!: NodeEnv;

  @Transform(numberOrDefault(DEFAULT_PORT))
  @IsInt({ message: 'PORT debe ser un número entero' })
  @Min(1, { message: 'PORT debe estar entre 1 y 65535' })
  @Max(65535, { message: 'PORT debe estar entre 1 y 65535' })
  PORT: number = DEFAULT_PORT;

  @IsString({ message: 'DATABASE_URL es requerida' })
  @Matches(/^postgresql:\/\/.+/, { message: 'DATABASE_URL debe ser una URL postgresql://' })
  DATABASE_URL!: string;

  @IsString({ message: 'REDIS_URL es requerida' })
  @Matches(/^rediss?:\/\/.+/, { message: 'REDIS_URL debe ser una URL redis:// o rediss://' })
  REDIS_URL!: string;

  @IsString({ message: 'JWT_ACCESS_SECRET es requerida' })
  @MinLength(MIN_SECRET_LENGTH, {
    message: `JWT_ACCESS_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
  })
  JWT_ACCESS_SECRET!: string;

  @IsString({ message: 'JWT_REFRESH_SECRET es requerida' })
  @MinLength(MIN_SECRET_LENGTH, {
    message: `JWT_REFRESH_SECRET debe tener al menos ${MIN_SECRET_LENGTH} caracteres`,
  })
  JWT_REFRESH_SECRET!: string;

  @Transform(stringOrDefault(DEFAULT_WEB_ORIGIN))
  @Matches(/^https?:\/\/.+/, { message: 'WEB_ORIGIN debe ser una URL http:// o https://' })
  WEB_ORIGIN: string = DEFAULT_WEB_ORIGIN;

  @Transform(numberOrDefault(DEFAULT_ACCESS_TTL))
  @IsInt({ message: 'JWT_ACCESS_TTL debe ser un número entero de segundos' })
  @Min(60, { message: 'JWT_ACCESS_TTL debe estar entre 60 y 3600 segundos' })
  @Max(3600, { message: 'JWT_ACCESS_TTL debe estar entre 60 y 3600 segundos' })
  JWT_ACCESS_TTL: number = DEFAULT_ACCESS_TTL;

  @Transform(numberOrDefault(DEFAULT_REFRESH_TTL))
  @IsInt({ message: 'JWT_REFRESH_TTL debe ser un número entero de segundos' })
  @Min(3600, { message: 'JWT_REFRESH_TTL debe estar entre 3600 y 2592000 segundos' })
  @Max(2592000, { message: 'JWT_REFRESH_TTL debe estar entre 3600 y 2592000 segundos' })
  JWT_REFRESH_TTL: number = DEFAULT_REFRESH_TTL;

  @Transform(numberOrDefault(DEFAULT_BCRYPT_ROUNDS))
  @IsInt({ message: 'BCRYPT_ROUNDS debe ser un número entero' })
  @Min(4, { message: 'BCRYPT_ROUNDS debe estar entre 4 y 15' })
  @Max(15, { message: 'BCRYPT_ROUNDS debe estar entre 4 y 15' })
  BCRYPT_ROUNDS: number = DEFAULT_BCRYPT_ROUNDS;

  @IsString({ message: 'MFA_ENCRYPTION_KEY es requerida' })
  @Matches(BASE64_PATTERN, { message: 'MFA_ENCRYPTION_KEY debe estar en base64' })
  MFA_ENCRYPTION_KEY!: string;

  @Transform(stringOrDefault(DEFAULT_MFA_ISSUER))
  @IsString({ message: 'MFA_ISSUER debe ser una cadena' })
  @Length(1, 64, { message: 'MFA_ISSUER debe tener entre 1 y 64 caracteres' })
  MFA_ISSUER: string = DEFAULT_MFA_ISSUER;
}

export interface AppConfig {
  readonly NODE_ENV: NodeEnv;
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly WEB_ORIGIN: string;
  readonly JWT_ACCESS_TTL: number;
  readonly JWT_REFRESH_TTL: number;
  readonly BCRYPT_ROUNDS: number;
  readonly MFA_ENCRYPTION_KEY: string;
  readonly MFA_ISSUER: string;
}

/**
 * Valida el entorno al arrancar. Si algo falta o es inválido lanza, y el proceso no queda
 * escuchando: fallar en el bootstrap es preferible a descubrir un secreto ausente en runtime.
 */
export function validateEnv(raw: Record<string, unknown>): AppConfig {
  const parsed = plainToInstance(EnvironmentVariables, raw, {
    enableImplicitConversion: false,
    exposeDefaultValues: true,
  });

  const errors = validateSync(parsed, { skipMissingProperties: false, whitelist: false });

  if (errors.length > 0) {
    const details = errors
      .map((error) => Object.values(error.constraints ?? {}).join('; '))
      .filter((message) => message.length > 0)
      .join('\n  - ');

    throw new Error(`Configuración de entorno inválida:\n  - ${details}`);
  }

  if (parsed.JWT_REFRESH_SECRET === parsed.JWT_ACCESS_SECRET) {
    throw new Error(
      'Configuración de entorno inválida:\n  - JWT_REFRESH_SECRET debe ser distinto de JWT_ACCESS_SECRET',
    );
  }

  // El largo se comprueba sobre los bytes decodificados, no sobre los caracteres: una clave de 16
  // bytes también es base64 válido, y AES-256-GCM la rechazaría recién al cifrar el primer secreto.
  const keyBytes = Buffer.from(parsed.MFA_ENCRYPTION_KEY, 'base64').byteLength;

  if (keyBytes !== MFA_KEY_BYTES) {
    throw new Error(
      `Configuración de entorno inválida:\n  - MFA_ENCRYPTION_KEY debe decodificar a exactamente ${String(MFA_KEY_BYTES)} bytes (tiene ${String(keyBytes)}); genérala con: openssl rand -base64 32`,
    );
  }

  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    DATABASE_URL: parsed.DATABASE_URL,
    REDIS_URL: parsed.REDIS_URL,
    JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET,
    WEB_ORIGIN: parsed.WEB_ORIGIN,
    JWT_ACCESS_TTL: parsed.JWT_ACCESS_TTL,
    JWT_REFRESH_TTL: parsed.JWT_REFRESH_TTL,
    BCRYPT_ROUNDS: parsed.BCRYPT_ROUNDS,
    MFA_ENCRYPTION_KEY: parsed.MFA_ENCRYPTION_KEY,
    MFA_ISSUER: parsed.MFA_ISSUER,
  };
}
