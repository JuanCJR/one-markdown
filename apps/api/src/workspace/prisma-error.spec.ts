import { HttpException, HttpStatus } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { toWorkspaceHttpException } from './prisma-error';

/**
 * Traducción de los errores de Prisma a HTTP (decisión 8 del plan de la spec 002).
 *
 * Los errores se construyen a mano, no provocándolos contra la base: lo que se prueba aquí es el
 * **mapeo**, y hacerlo con una base real ataría este test a que exista una fila duplicada.
 *
 * Las formas de `meta` no son inventadas: son las que emite de verdad Prisma 7.9 con el driver
 * adapter `@prisma/adapter-pg` que usa este proyecto (`modelName` + `driverAdapterError`), y
 * también la clásica `meta.target` que emite el motor sin adapter. Se prueban las dos porque el
 * mapeo tiene que sobrevivir a que el adapter cambie.
 */

const CLIENT_VERSION = '7.9.0';

const knownError = (
  code: string,
  meta?: Record<string, unknown>,
): Prisma.PrismaClientKnownRequestError =>
  new Prisma.PrismaClientKnownRequestError(`fallo simulado ${code}`, {
    code,
    clientVersion: CLIENT_VERSION,
    ...(meta === undefined ? {} : { meta }),
  });

/** `meta` tal como llega con el driver adapter de pg en una violación de índice único (23505). */
const uniqueViolationMeta = (
  modelName: string,
  constraint: string,
  fields: readonly string[],
): Record<string, unknown> => ({
  modelName,
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23505',
      originalMessage: `duplicate key value violates unique constraint "${constraint}"`,
      kind: 'UniqueConstraintViolation',
      constraint: { fields: [...fields] },
    },
  },
});

/** `meta` del driver adapter en una violación de clave ajena (23503). */
const foreignKeyViolationMeta = (modelName: string, table: string, constraint: string) => ({
  modelName,
  driverAdapterError: {
    name: 'DriverAdapterError',
    cause: {
      originalCode: '23503',
      originalMessage: `insert or update on table "${table}" violates foreign key constraint "${constraint}"`,
      kind: 'ForeignKeyConstraintViolation',
      constraint: { index: constraint },
    },
  },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/** Lo que lanzó `run`, sea lo que sea. Falla el test si no lanza nada. */
function captureThrown(run: () => void): unknown {
  try {
    run();
  } catch (error) {
    return error;
  }

  throw new Error('se esperaba que toWorkspaceHttpException lanzara, y no lanzó');
}

interface TranslatedError {
  readonly status: number;
  readonly body: Record<string, unknown>;
}

/** Traduce y devuelve el estado y el cuerpo del `HttpException` resultante. */
function translate(error: unknown): TranslatedError {
  const thrown = captureThrown(() => {
    toWorkspaceHttpException(error);
  });

  if (!(thrown instanceof HttpException)) {
    throw new Error(`se esperaba un HttpException y llegó: ${String(thrown)}`);
  }

  const raw: unknown = thrown.getResponse();

  if (!isRecord(raw)) {
    throw new Error(`el cuerpo del HttpException no es un objeto: ${String(raw)}`);
  }

  return { status: thrown.getStatus(), body: raw };
}

describe('toWorkspaceHttpException', () => {
  describe('P2002 — violación de unicidad → 409 con el code del recurso', () => {
    it('reconoce el índice de directorios por el meta del driver adapter', () => {
      const { status, body } = translate(
        knownError(
          'P2002',
          uniqueViolationMeta('Directory', 'directories_parentScopeId_nameKey_key', [
            '"parentScopeId"',
            '"nameKey"',
          ]),
        ),
      );

      expect(status).toBe(HttpStatus.CONFLICT);
      expect(body['code']).toBe('DIRECTORY_NAME_TAKEN');
      expect(typeof body['message']).toBe('string');
    });

    it('reconoce el índice de documentos por el meta del driver adapter', () => {
      const { status, body } = translate(
        knownError(
          'P2002',
          uniqueViolationMeta('Document', 'documents_parentScopeId_titleKey_key', [
            '"parentScopeId"',
            '"titleKey"',
          ]),
        ),
      );

      expect(status).toBe(HttpStatus.CONFLICT);
      expect(body['code']).toBe('DOCUMENT_TITLE_TAKEN');
    });

    it('reconoce el recurso por el meta.target clásico (lista de campos)', () => {
      expect(translate(knownError('P2002', { target: ['parentScopeId', 'nameKey'] })).body['code']).toBe(
        'DIRECTORY_NAME_TAKEN',
      );

      expect(
        translate(knownError('P2002', { target: ['parentScopeId', 'titleKey'] })).body['code'],
      ).toBe('DOCUMENT_TITLE_TAKEN');
    });

    it('reconoce el recurso por el meta.target clásico (nombre del índice como string)', () => {
      expect(
        translate(knownError('P2002', { target: 'documents_parentScopeId_titleKey_key' })).body[
          'code'
        ],
      ).toBe('DOCUMENT_TITLE_TAKEN');
    });

    it('sigue siendo un 409, pero sin code, cuando el meta no dice de qué recurso es', () => {
      const { status, body } = translate(knownError('P2002', {}));

      expect(status).toBe(HttpStatus.CONFLICT);
      expect(body['code']).toBeUndefined();
    });
  });

  describe('P2003 — clave ajena → 404 PARENT_NOT_FOUND', () => {
    it('traduce el padre de un directorio', () => {
      const { status, body } = translate(
        knownError(
          'P2003',
          foreignKeyViolationMeta('Directory', 'directories', 'directories_parentId_fkey'),
        ),
      );

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body['code']).toBe('PARENT_NOT_FOUND');
    });

    it('traduce el directorio de un documento', () => {
      const { status, body } = translate(
        knownError(
          'P2003',
          foreignKeyViolationMeta('Document', 'documents', 'documents_directoryId_fkey'),
        ),
      );

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body['code']).toBe('PARENT_NOT_FOUND');
    });
  });

  describe('P2025 — registro no encontrado → 404', () => {
    it('usa DIRECTORY_NOT_FOUND cuando el meta nombra el modelo Directory', () => {
      const { status, body } = translate(
        knownError('P2025', { modelName: 'Directory', operation: 'an update' }),
      );

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body['code']).toBe('DIRECTORY_NOT_FOUND');
    });

    it('usa DOCUMENT_NOT_FOUND cuando el meta nombra el modelo Document', () => {
      const { status, body } = translate(
        knownError('P2025', { modelName: 'Document', operation: 'a delete' }),
      );

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body['code']).toBe('DOCUMENT_NOT_FOUND');
    });

    it('sigue siendo un 404, sin code, si el meta no nombra el modelo', () => {
      const { status, body } = translate(knownError('P2025'));

      expect(status).toBe(HttpStatus.NOT_FOUND);
      expect(body['code']).toBeUndefined();
    });
  });

  it('traduce P2034 (fallo de serialización) a 409 WORKSPACE_CONFLICT', () => {
    const { status, body } = translate(knownError('P2034'));

    expect(status).toBe(HttpStatus.CONFLICT);
    expect(body['code']).toBe('WORKSPACE_CONFLICT');
  });

  describe('todo lo demás se propaga sin tocar: un 500 no se disfraza de 409', () => {
    it('deja pasar un error conocido de Prisma con otro código', () => {
      const original = knownError('P2000', { modelName: 'Directory' });

      expect(captureThrown(() => {
        toWorkspaceHttpException(original);
      })).toBe(original);
    });

    it('deja pasar un error genérico', () => {
      const original = new Error('la conexión con la base se cayó');

      const thrown = captureThrown(() => {
        toWorkspaceHttpException(original);
      });

      expect(thrown).toBe(original);
      expect(thrown).not.toBeInstanceOf(HttpException);
    });

    it('deja pasar un valor lanzado que ni siquiera es un Error', () => {
      const original = 'algo salió mal';

      expect(captureThrown(() => {
        toWorkspaceHttpException(original);
      })).toBe(original);
    });
  });
});
