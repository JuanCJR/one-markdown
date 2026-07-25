import './fixtures/env-development';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/** Lo que estos casos necesitan del documento OpenAPI, tipado en vez de leído a ciegas. */
interface OpenApiOperation {
  readonly operationId?: string;
  readonly security?: ReadonlyArray<Record<string, readonly string[]>>;
  readonly responses?: Record<string, unknown>;
}

interface OpenApiSecurityScheme {
  readonly type?: string;
  readonly scheme?: string;
  readonly bearerFormat?: string;
  readonly in?: string;
  readonly name?: string;
}

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, OpenApiOperation>>;
  readonly components?: {
    readonly schemas?: Record<string, unknown>;
    readonly securitySchemes?: Record<string, OpenApiSecurityScheme>;
  };
}

/** Las nueve rutas de `/api/auth/*` de `plan.md` §3, con el método que expone cada una. */
const AUTH_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['/api/auth/register', 'post'],
  ['/api/auth/login', 'post'],
  ['/api/auth/refresh', 'post'],
  ['/api/auth/logout', 'post'],
  ['/api/auth/me', 'get'],
  ['/api/auth/mfa/setup', 'post'],
  ['/api/auth/mfa/enable', 'post'],
  ['/api/auth/mfa/verify', 'post'],
  ['/api/auth/mfa/disable', 'post'],
];

/** Endpoints cuya credencial es el access token: tienen que declararlo, o el cliente no sabe firmar. */
const BEARER_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['/api/auth/me', 'get'],
  ['/api/auth/mfa/setup', 'post'],
  ['/api/auth/mfa/enable', 'post'],
  ['/api/auth/mfa/disable', 'post'],
];

/** La credencial es la cookie `om_refresh`, no el Bearer. */
const COOKIE_ROUTES: ReadonlyArray<readonly [string, string]> = [
  ['/api/auth/refresh', 'post'],
  ['/api/auth/logout', 'post'],
];

const BEARER_SCHEME = 'bearer';
const COOKIE_SCHEME = 'om_refresh';

const AUTH_SCHEMAS = [
  'UserResponseDto',
  'AuthSessionResponseDto',
  'LoginResponseDto',
  'MfaSetupResponseDto',
  'MfaRecoveryCodesResponseDto',
  'RegisterRequestDto',
  'LoginRequestDto',
  'MfaVerifyRequestDto',
  'MfaEnableRequestDto',
  'MfaDisableRequestDto',
];

/** Nombres de los modelos de Prisma, leídos del esquema real: no hay lista que se quede vieja. */
function prismaModelNames(): string[] {
  const schema = readFileSync(join(__dirname, '..', 'prisma', 'schema.prisma'), 'utf8');

  return [...schema.matchAll(/^model\s+(\w+)\s*\{/gm)].map(([, name]) => String(name));
}

describe('Swagger fuera de producción (e2e) — AC-7, AC-21', () => {
  let app: INestApplication;
  let document: OpenApiDocument;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    configureApp(app);
    await app.init();

    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);
    document = response.body as OpenApiDocument;
  });

  afterAll(async () => {
    await app.close();
  });

  it('sirve /api/docs-json con la ruta /api/health documentada', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.paths).toHaveProperty(['/api/health']);
    expect(response.body.paths['/api/health']).toHaveProperty('get');
  });

  it('expone el schema HealthResponseDto con sus tres propiedades', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    const schema = response.body.components?.schemas?.HealthResponseDto;
    expect(schema).toBeDefined();
    expect(Object.keys(schema.properties).sort()).toEqual(['status', 'uptimeSeconds', 'version']);
  });

  it('documenta ErrorResponseDto como contrato de error', async () => {
    const response = await request(app.getHttpServer()).get('/api/docs-json').expect(200);

    expect(response.body.components?.schemas?.ErrorResponseDto).toBeDefined();
  });

  it('sirve la UI en /api/docs', async () => {
    await request(app.getHttpServer()).get('/api/docs').expect(200);
  });

  describe('AC-21: las nueve rutas de auth', () => {
    it.each(AUTH_ROUTES)('documenta %s (%s)', (path, method) => {
      expect(document.paths[path]).toBeDefined();
      expect(document.paths[path]?.[method]).toBeDefined();
    });

    it('no documenta ninguna ruta de auth de más', () => {
      const documentadas = Object.keys(document.paths).filter((path) =>
        path.startsWith('/api/auth'),
      );

      expect(documentadas.sort()).toEqual([...new Set(AUTH_ROUTES.map(([path]) => path))].sort());
    });

    it('cada operación de auth tiene operationId, para que el cliente pueda generarse', () => {
      for (const [path, method] of AUTH_ROUTES) {
        expect(document.paths[path]?.[method]?.operationId).toEqual(expect.any(String));
      }
    });
  });

  describe('AC-21: esquemas de seguridad declarados', () => {
    it('declara el securityScheme bearer de tipo http con formato JWT', () => {
      const scheme = document.components?.securitySchemes?.[BEARER_SCHEME];

      expect(scheme).toBeDefined();
      expect(scheme?.type).toBe('http');
      expect(scheme?.scheme).toBe('bearer');
      expect(scheme?.bearerFormat).toBe('JWT');
    });

    it('declara el securityScheme de la cookie de refresh', () => {
      const scheme = document.components?.securitySchemes?.[COOKIE_SCHEME];

      expect(scheme).toBeDefined();
      expect(scheme?.type).toBe('apiKey');
      expect(scheme?.in).toBe('cookie');
      expect(scheme?.name).toBe(COOKIE_SCHEME);
    });

    it.each(BEARER_ROUTES)('%s (%s) declara security con bearer', (path, method) => {
      const security = document.paths[path]?.[method]?.security ?? [];

      expect(security.some((requisito) => BEARER_SCHEME in requisito)).toBe(true);
    });

    it.each(COOKIE_ROUTES)('%s (%s) declara security con la cookie', (path, method) => {
      const security = document.paths[path]?.[method]?.security ?? [];

      expect(security.some((requisito) => COOKIE_SCHEME in requisito)).toBe(true);
    });

    // Un endpoint público que declarase Bearer haría que el cliente generado exigiera un token que
    // nadie tiene todavía: el login y el canje del segundo factor ocurren *antes* de haberlo.
    it.each([
      ['/api/auth/register', 'post'],
      ['/api/auth/login', 'post'],
      ['/api/auth/mfa/verify', 'post'],
    ])('%s (%s) no declara ninguna credencial', (path, method) => {
      expect(document.paths[path]?.[method]?.security ?? []).toEqual([]);
    });
  });

  describe('AC-21: schemas de los DTO de auth y MFA', () => {
    it.each(AUTH_SCHEMAS)('expone el schema %s', (name) => {
      expect(document.components?.schemas?.[name]).toBeDefined();
    });

    it('todas las respuestas de error de auth apuntan a ErrorResponseDto', () => {
      for (const [path, method] of AUTH_ROUTES) {
        const responses = document.paths[path]?.[method]?.responses ?? {};
        const errores = Object.keys(responses).filter((code) => Number(code) >= 400);

        expect(errores.length).toBeGreaterThan(0);
        expect(JSON.stringify(responses)).toContain('ErrorResponseDto');
      }
    });

    it('el 429 está documentado en todos los endpoints con rate limit (AC-20)', () => {
      for (const [path, method] of AUTH_ROUTES) {
        expect(Object.keys(document.paths[path]?.[method]?.responses ?? {})).toContain('429');
      }
    });
  });

  describe('AC-21: ningún modelo de Prisma sale al contrato', () => {
    it('ningún schema del documento se llama como un modelo de Prisma', () => {
      const schemas = Object.keys(document.components?.schemas ?? {});
      const modelos = prismaModelNames();

      expect(modelos.length).toBeGreaterThan(0);
      expect(schemas.filter((name) => modelos.includes(name))).toEqual([]);
    });

    it('el documento no menciona passwordHash ni mfaSecret en ninguna parte', () => {
      const serializado = JSON.stringify(document);

      expect(serializado).not.toContain('passwordHash');
      expect(serializado).not.toContain('mfaSecret');
    });
  });
});
