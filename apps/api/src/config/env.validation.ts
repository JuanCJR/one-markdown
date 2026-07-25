import { plainToInstance, Transform, type TransformFnParams } from 'class-transformer';
import { IsIn, IsInt, IsString, Matches, Max, Min, MinLength, validateSync } from 'class-validator';

export const NODE_ENVS = ['development', 'test', 'production'] as const;
export type NodeEnv = (typeof NODE_ENVS)[number];

// 3001 y no 3000: el 3000 es el puerto más disputado de cualquier máquina de desarrollo.
const DEFAULT_PORT = 3001;
const DEFAULT_WEB_ORIGIN = 'http://localhost:5173';
const MIN_SECRET_LENGTH = 32;

/** Los mensajes nombran siempre la variable: el operador tiene que saber cuál arreglar (AC-6). */
class EnvironmentVariables {
  @IsIn(NODE_ENVS, { message: `NODE_ENV debe ser uno de: ${NODE_ENVS.join(', ')}` })
  NODE_ENV!: NodeEnv;

  @Transform(({ value }: TransformFnParams): number =>
    value === undefined || value === '' ? DEFAULT_PORT : Number(value),
  )
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

  @Transform(({ value }: TransformFnParams): string =>
    value === undefined || value === '' ? DEFAULT_WEB_ORIGIN : String(value),
  )
  @Matches(/^https?:\/\/.+/, { message: 'WEB_ORIGIN debe ser una URL http:// o https://' })
  WEB_ORIGIN: string = DEFAULT_WEB_ORIGIN;
}

export interface AppConfig {
  readonly NODE_ENV: NodeEnv;
  readonly PORT: number;
  readonly DATABASE_URL: string;
  readonly REDIS_URL: string;
  readonly JWT_ACCESS_SECRET: string;
  readonly JWT_REFRESH_SECRET: string;
  readonly WEB_ORIGIN: string;
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

  return {
    NODE_ENV: parsed.NODE_ENV,
    PORT: parsed.PORT,
    DATABASE_URL: parsed.DATABASE_URL,
    REDIS_URL: parsed.REDIS_URL,
    JWT_ACCESS_SECRET: parsed.JWT_ACCESS_SECRET,
    JWT_REFRESH_SECRET: parsed.JWT_REFRESH_SECRET,
    WEB_ORIGIN: parsed.WEB_ORIGIN,
  };
}
