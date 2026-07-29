import './fixtures/env-development';

import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';

import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';

/** Lo que estos casos necesitan del documento OpenAPI, tipado en vez de leído a ciegas. */
interface OpenApiParameter {
  readonly name?: string;
  readonly in?: string;
  readonly required?: boolean;
  readonly schema?: { readonly type?: string };
}

interface OpenApiOperation {
  readonly operationId?: string;
  readonly security?: ReadonlyArray<Record<string, readonly string[]>>;
  readonly responses?: Record<string, unknown>;
  readonly parameters?: readonly OpenApiParameter[];
}

interface OpenApiSecurityScheme {
  readonly type?: string;
  readonly scheme?: string;
  readonly bearerFormat?: string;
  readonly in?: string;
  readonly name?: string;
}

/** Lo único que estos casos leen de un schema: sus propiedades declaradas. */
interface OpenApiSchema {
  readonly properties?: Record<string, unknown>;
}

interface OpenApiDocument {
  readonly paths: Record<string, Record<string, OpenApiOperation>>;
  readonly components?: {
    readonly schemas?: Record<string, OpenApiSchema>;
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

/**
 * Las once rutas de `/api/workspace/*` de `plan.md` §4 (diez de la `002` más el guardado de
 * contenido de la `003`), con su método y su `operationId`.
 *
 * El `operationId` va aquí y no se comprueba solo «que exista»: es el nombre de la función en el
 * cliente generado, así que cambiarlo es un cambio incompatible que el frontend nota en compilación.
 */
const WORKSPACE_ROUTES: ReadonlyArray<readonly [string, string, string]> = [
  ['/api/workspace/tree', 'get', 'getWorkspaceTree'],
  ['/api/workspace/directories', 'post', 'createDirectory'],
  ['/api/workspace/directories/{id}', 'patch', 'renameDirectory'],
  ['/api/workspace/directories/{id}', 'delete', 'deleteDirectory'],
  ['/api/workspace/directories/{id}/move', 'post', 'moveDirectory'],
  ['/api/workspace/documents', 'post', 'createDocument'],
  ['/api/workspace/documents/{id}', 'get', 'getDocument'],
  ['/api/workspace/documents/{id}', 'patch', 'renameDocument'],
  ['/api/workspace/documents/{id}', 'delete', 'deleteDocument'],
  ['/api/workspace/documents/{id}/move', 'post', 'moveDocument'],
  ['/api/workspace/documents/{id}/content', 'put', 'saveDocumentContent'],
];

/** La única ruta de workspace que no resuelve ningún id de recurso (`plan.md` §4). */
const WORKSPACE_TREE_PATH = '/api/workspace/tree';

/**
 * Las **diez** rutas que sí pueden emitir un `404`, derivadas por filtro de `WORKSPACE_ROUTES` y
 * **no** escritas aparte: una segunda lista a mano se desincroniza en cuanto se añada una ruta.
 *
 * El criterio es «resuelve algún id de recurso», que es lo que `plan.md` §4 enumera ruta por ruta:
 * ocho lo toman de la plantilla de ruta (`{id}` → `DIRECTORY_NOT_FOUND` / `DOCUMENT_NOT_FOUND`) y los
 * dos `POST` de creación lo toman del cuerpo (`parentId` / `directoryId` → `PARENT_NOT_FOUND`, §4
 * líneas 197 y 249). Por eso el filtro **no** puede ser `{id}` en la ruta: eso daría ocho, no diez.
 * `/tree` es la única sin ninguna de las dos formas, así que el complemento es exactamente ella.
 */
const WORKSPACE_NOT_FOUND_ROUTES = WORKSPACE_ROUTES.filter(
  ([path]) => path !== WORKSPACE_TREE_PATH,
);

/** El complemento: la única ruta sin `404`. Anclarlo impide que el filtro de arriba se vacíe. */
const WORKSPACE_ROUTES_SIN_NOT_FOUND = WORKSPACE_ROUTES.filter(
  ([path]) => path === WORKSPACE_TREE_PATH,
);

/** Los cinco DTO de salida del módulo (`plan.md` §4, con el de la `003`). */
const WORKSPACE_RESPONSE_SCHEMAS: readonly string[] = [
  'WorkspaceTreeResponseDto',
  'WorkspaceDirectoryResponseDto',
  'WorkspaceDocumentSummaryResponseDto',
  'WorkspaceDocumentResponseDto',
  'WorkspaceDocumentContentResponseDto',
];

/** Los ocho DTO de entrada del módulo: siete cuerpos y una *query string*. */
const WORKSPACE_REQUEST_SCHEMAS: readonly string[] = [
  'CreateDirectoryRequestDto',
  'RenameDirectoryRequestDto',
  'MoveDirectoryRequestDto',
  'DeleteDirectoryQueryDto',
  'CreateDocumentRequestDto',
  'RenameDocumentRequestDto',
  'MoveDocumentRequestDto',
  'SaveDocumentContentRequestDto',
];

/**
 * Los DTO de entrada que existen **de verdad** en `src/workspace/dto`, derivados del nombre de cada
 * archivo (`create-directory.request.dto.ts` → `CreateDirectoryRequestDto`).
 *
 * Sirve para que la cifra «siete» no sea un número escrito a mano en el test: si mañana aparece un
 * octavo DTO de entrada y nadie lo documenta, la lista de disco deja de coincidir con la esperada.
 */
function workspaceRequestDtoNamesOnDisk(): string[] {
  const dir = join(__dirname, '..', 'src', 'workspace', 'dto');

  return readdirSync(dir)
    .filter((file) => file.endsWith('.request.dto.ts') || file.endsWith('.query.dto.ts'))
    .map((file) =>
      file
        .replace(/\.ts$/, '')
        .split(/[.-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(''),
    )
    .sort();
}

/** Campos internos del esquema que **nunca** pueden aparecer en el contrato público (AC-26). */
const CAMPOS_INTERNOS: readonly string[] = ['nameKey', 'titleKey', 'parentScopeId', 'userId'];

/** La ruta de guardado de contenido que añade la spec `003` (AC-12). */
const CONTENT_PATH = '/api/workspace/documents/{id}/content';
const CONTENT_METHOD = 'put';
const CONTENT_OPERATION_ID = 'saveDocumentContent';

/**
 * Los **seis** códigos de error que `PUT …/content` tiene que declarar (AC-12).
 *
 * El que de verdad justifica la lista es el `409`: es el único que obliga al cliente a implementar
 * una rama entera de interfaz —el diálogo de conflicto de AC-20— y el único que no aparece en
 * ninguna otra ruta de documento por el mismo motivo (aquí choca la **versión**, no el título). Un
 * `409` sin documentar deja al cliente creyendo que un guardado solo puede fallar por credencial o
 * por validación, y el defecto no se nota hasta que dos pestañas escriben a la vez.
 */
const CONTENT_ERROR_CODES: readonly string[] = ['400', '401', '404', '409', '413', '429'];

/** Los dos schemas que la ruta nueva estrena: uno de entrada y uno de salida (AC-12). */
const CONTENT_SCHEMAS: readonly string[] = [
  'SaveDocumentContentRequestDto',
  'WorkspaceDocumentContentResponseDto',
];

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

  describe('AC-26: las once rutas de workspace', () => {
    // Ancla: si mañana alguien borra una fila de la tabla, los `it.each` de abajo seguirían en verde
    // recorriendo menos casos. Esta cuenta es la que impide que la cobertura se encoja en silencio.
    it('la tabla de rutas cubre las once de plan.md §4, sin repetir método', () => {
      expect(WORKSPACE_ROUTES).toHaveLength(11);
      expect(new Set(WORKSPACE_ROUTES.map(([path, method]) => `${method} ${path}`)).size).toBe(11);
    });

    it.each(WORKSPACE_ROUTES)(
      'documenta %s (%s) con operationId %s',
      (path, method, operationId) => {
        expect(document.paths[path]).toBeDefined();
        expect(document.paths[path]?.[method]).toBeDefined();
        expect(document.paths[path]?.[method]?.operationId).toBe(operationId);
      },
    );

    it('no documenta ninguna ruta de workspace de más', () => {
      const documentadas = Object.keys(document.paths).filter((path) =>
        path.startsWith('/api/workspace'),
      );

      expect(documentadas.sort()).toEqual(
        [...new Set(WORKSPACE_ROUTES.map(([path]) => path))].sort(),
      );
    });

    it('no documenta ningún método de workspace de más', () => {
      const operaciones = Object.entries(document.paths)
        .filter(([path]) => path.startsWith('/api/workspace'))
        .flatMap(([path, methods]) => Object.keys(methods).map((method) => `${method} ${path}`));

      expect(operaciones.sort()).toEqual(
        WORKSPACE_ROUTES.map(([path, method]) => `${method} ${path}`).sort(),
      );
    });
  });

  describe('AC-26: credenciales y errores de workspace', () => {
    it.each(WORKSPACE_ROUTES)('%s (%s) declara security con bearer', (path, method) => {
      const security = document.paths[path]?.[method]?.security ?? [];

      expect(security.length).toBeGreaterThan(0);
      expect(security.some((requisito) => BEARER_SCHEME in requisito)).toBe(true);
    });

    // Ancla de la partición (v0.2.2): diez rutas con `404` + una sin él = las once. Sin estas dos
    // cuentas, un filtro que se quedara vacío dejaría los `it.each` de `404` sin recorrer nada.
    it('la partición de 404 es diez rutas con y una sin, y la que no lo tiene es /tree', () => {
      expect(WORKSPACE_NOT_FOUND_ROUTES).toHaveLength(10);
      expect(WORKSPACE_ROUTES_SIN_NOT_FOUND).toHaveLength(1);
      expect(WORKSPACE_ROUTES_SIN_NOT_FOUND[0]).toEqual([
        WORKSPACE_TREE_PATH,
        'get',
        expect.any(String),
      ]);
    });

    // `401` y `429` sí van en las diez: cualquier ruta del tag puede quedarse sin token o topar con
    // el rate limit. El `404`, en cambio, se exige aparte porque `/tree` no puede emitirlo (AC-26).
    it.each(WORKSPACE_ROUTES)('%s (%s) documenta 401 y 429', (path, method) => {
      const responses = document.paths[path]?.[method]?.responses ?? {};

      expect(Object.keys(responses)).toEqual(expect.arrayContaining(['401', '429']));
    });

    it.each(WORKSPACE_NOT_FOUND_ROUTES)('%s (%s) documenta 404', (path, method) => {
      const responses = document.paths[path]?.[method]?.responses ?? {};

      expect(Object.keys(responses)).toEqual(expect.arrayContaining(['404']));
    });

    it.each(WORKSPACE_ROUTES)('%s (%s) apunta a ErrorResponseDto en 401 y 429', (path, method) => {
      const responses = document.paths[path]?.[method]?.responses ?? {};

      for (const code of ['401', '429']) {
        expect(JSON.stringify(responses[code])).toContain('ErrorResponseDto');
      }
    });

    it.each(WORKSPACE_NOT_FOUND_ROUTES)(
      '%s (%s) apunta a ErrorResponseDto en 404',
      (path, method) => {
        const responses = document.paths[path]?.[method]?.responses ?? {};

        expect(JSON.stringify(responses['404'])).toContain('ErrorResponseDto');
      },
    );

    // Caso en negativo (v0.2.2). Está anclado a propósito: «no tiene la clave 404» es cierto por
    // vacío si la operación no existe o si el path está mal escrito, así que primero se afirma que la
    // operación está ahí y que sí declara `401` y `429`. Solo entonces la ausencia del `404` significa
    // algo. Es lo que impide que la declaración vuelva a colarse por «uniformidad del tag».
    it('GET /api/workspace/tree no declara 404, y no por estar vacío', () => {
      const operacion = document.paths[WORKSPACE_TREE_PATH]?.get;

      expect(operacion).toBeDefined();
      expect(operacion?.operationId).toBe('getWorkspaceTree');

      const responses = operacion?.responses ?? {};

      expect(Object.keys(responses)).toEqual(expect.arrayContaining(['200', '401', '429']));
      expect(Object.keys(responses)).not.toContain('404');
      expect(responses['404']).toBeUndefined();
    });

    it('el DELETE de directorios documenta el query param recursive como booleano opcional', () => {
      const parametros =
        document.paths['/api/workspace/directories/{id}']?.delete?.parameters ?? [];
      const recursive = parametros.find((parametro) => parametro.name === 'recursive');

      expect(recursive).toBeDefined();
      expect(recursive?.in).toBe('query');
      expect(recursive?.required).toBe(false);
      expect(recursive?.schema?.type).toBe('boolean');
    });
  });

  describe('AC-26: schemas de los DTO de workspace', () => {
    it.each(WORKSPACE_RESPONSE_SCHEMAS)('expone el schema de salida %s', (name) => {
      expect(document.components?.schemas?.[name]).toBeDefined();
    });

    it('los DTO de entrada esperados son exactamente los ocho que hay en src/workspace/dto', () => {
      expect(WORKSPACE_REQUEST_SCHEMAS).toHaveLength(8);
      expect([...WORKSPACE_REQUEST_SCHEMAS].sort()).toEqual(workspaceRequestDtoNamesOnDisk());
    });

    it.each(WORKSPACE_REQUEST_SCHEMAS)('expone el schema de entrada %s', (name) => {
      expect(document.components?.schemas?.[name]).toBeDefined();
    });
  });

  // Spec 003, AC-12. La ruta que estrena el guardado de contenido se afirma **aparte** de las tablas
  // de la `002` y no solo por recuento: contarla demuestra que existe, y lo que un cliente necesita
  // saber es qué credencial firma, qué puede salir mal y con qué forma.
  describe('AC-12 (spec 003): PUT /api/workspace/documents/{id}/content', () => {
    it('documenta la operación con su operationId', () => {
      const operacion = document.paths[CONTENT_PATH]?.[CONTENT_METHOD];

      expect(operacion).toBeDefined();
      expect(operacion?.operationId).toBe(CONTENT_OPERATION_ID);
    });

    it('declara security con bearer', () => {
      const security = document.paths[CONTENT_PATH]?.[CONTENT_METHOD]?.security ?? [];

      expect(security.length).toBeGreaterThan(0);
      expect(security.some((requisito) => BEARER_SCHEME in requisito)).toBe(true);
    });

    it.each(CONTENT_ERROR_CODES)('documenta el %s con forma de ErrorResponseDto', (code) => {
      const responses = document.paths[CONTENT_PATH]?.[CONTENT_METHOD]?.responses ?? {};

      expect(Object.keys(responses)).toEqual(expect.arrayContaining([code]));
      expect(JSON.stringify(responses[code])).toContain('ErrorResponseDto');
    });

    // Ancla de la lista de arriba, por el mismo motivo que las cuentas de rutas: si alguien borra una
    // fila de `CONTENT_ERROR_CODES`, el `it.each` seguiría verde recorriendo un código menos.
    it('los códigos exigidos son los seis de AC-12, incluido el 409', () => {
      expect([...CONTENT_ERROR_CODES].sort()).toEqual([
        '400',
        '401',
        '404',
        '409',
        '413',
        '429',
      ]);
    });

    it('declara el 200 con WorkspaceDocumentContentResponseDto', () => {
      const responses = document.paths[CONTENT_PATH]?.[CONTENT_METHOD]?.responses ?? {};

      expect(Object.keys(responses)).toEqual(expect.arrayContaining(['200']));
      expect(JSON.stringify(responses['200'])).toContain('WorkspaceDocumentContentResponseDto');
    });

    it('resuelve el :id como parámetro de ruta obligatorio', () => {
      const parametros = document.paths[CONTENT_PATH]?.[CONTENT_METHOD]?.parameters ?? [];
      const id = parametros.find((parametro) => parametro.name === 'id');

      expect(id).toBeDefined();
      expect(id?.in).toBe('path');
      expect(id?.required).toBe(true);
    });

    it.each(CONTENT_SCHEMAS)('expone el schema %s', (name) => {
      expect(document.components?.schemas?.[name]).toBeDefined();
    });

    // AC-11 de la `003` es lo que obliga a la enmienda de la `002`: sin `contentVersion` publicado,
    // el cliente no tendría de dónde sacar el token con el que emitir su primer guardado.
    it('WorkspaceDocumentResponseDto declara contentVersion', () => {
      const schema = document.components?.schemas?.WorkspaceDocumentResponseDto;

      expect(schema).toBeDefined();
      expect(Object.keys(schema?.properties ?? {})).toEqual(
        expect.arrayContaining(['contentVersion']),
      );
    });
  });

  describe('AC-26: el contrato de workspace no filtra el esquema', () => {
    // La red de «ningún schema se llama como un modelo de Prisma» solo sirve si la lista que sale
    // del esquema real está poblada: un `schema.prisma` que la regex no supiera leer dejaría el
    // filtro recorriendo un array vacío y el test pasaría sin comprobar nada.
    it('la lista de modelos del schema.prisma real trae los cuatro modelos actuales', () => {
      expect(prismaModelNames().sort()).toEqual([
        'Directory',
        'Document',
        'MfaRecoveryCode',
        'User',
      ]);
    });

    // Y el caso concreto que motivó el prefijo `Workspace` en todos los DTO (riesgo #10 del plan):
    // `Directory` y `Document` son nombres de modelo, así que ningún schema puede llamarse así.
    it('ningún schema del documento se llama Directory ni Document', () => {
      const schemas = Object.keys(document.components?.schemas ?? {});

      expect(schemas.length).toBeGreaterThan(0);
      expect(schemas).not.toContain('Directory');
      expect(schemas).not.toContain('Document');
    });

    it.each(CAMPOS_INTERNOS)('el documento no menciona %s en ninguna parte', (campo) => {
      expect(JSON.stringify(document)).not.toContain(campo);
    });
  });
});
