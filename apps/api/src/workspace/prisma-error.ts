import { ConflictException, HttpException, NotFoundException } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import type { WorkspaceErrorCode } from './workspace.errors';

/**
 * Traducción de los errores de Prisma a HTTP, en **un solo sitio** (decisión 8 del plan de la
 * spec 002).
 *
 * La alternativa —comprobar con un `findFirst` antes de escribir— no es atómica: entre la
 * comprobación y el `create` cabe otra petición, así que el índice único acaba disparando de todas
 * formas y hay que traducirlo igual. Se traduce aquí y se prueba aquí.
 *
 * Regla que gobierna el resto: **lo que no se reconoce se propaga sin tocar**. Un `500` disfrazado
 * de `409` es peor que un `500`, porque el cliente reintenta con otro nombre y el fallo real —una
 * base caída, una consulta mal formada— nunca sale a la luz.
 */

/** Los dos recursos del workspace; determinan qué `code` lleva un conflicto o un no-encontrado. */
type WorkspaceResource = 'directory' | 'document';

const P2002_UNIQUE_VIOLATION = 'P2002';
const P2003_FOREIGN_KEY_VIOLATION = 'P2003';
const P2025_RECORD_NOT_FOUND = 'P2025';
const P2034_WRITE_CONFLICT = 'P2034';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

/**
 * Todo el texto del `meta` que puede delatar de qué tabla vino el error, en un único string.
 *
 * Hay dos formas y las dos son reales: el motor **sin** driver adapter emite `meta.target` (lista
 * de campos o nombre del índice), y con el adapter `@prisma/adapter-pg` que usa este proyecto emite
 * `meta.modelName` más un `meta.driverAdapterError.cause` con el nombre de la restricción y el
 * mensaje original de PostgreSQL. Se recogen las dos para que el mapeo sobreviva a que el adapter
 * entre o salga.
 */
function metaHaystack(meta: unknown): string {
  if (!isRecord(meta)) {
    return '';
  }

  const parts: string[] = [];

  const push = (value: unknown): void => {
    if (typeof value === 'string') {
      parts.push(value);
    } else if (Array.isArray(value)) {
      for (const item of value) {
        push(item);
      }
    } else if (isRecord(value)) {
      for (const nested of Object.values(value)) {
        push(nested);
      }
    }
  };

  push(meta['target']);
  push(meta['driverAdapterError']);

  return parts.join(' ').toLowerCase();
}

/**
 * De qué recurso es el error, o `null` si el `meta` no lo dice. `modelName` manda cuando está
 * porque es el dato estructurado; el resto es el texto de la restricción, que sirve de red.
 */
function resourceOf(meta: unknown): WorkspaceResource | null {
  if (isRecord(meta)) {
    const modelName = meta['modelName'];

    if (modelName === 'Directory') {
      return 'directory';
    }

    if (modelName === 'Document') {
      return 'document';
    }
  }

  const haystack = metaHaystack(meta);
  const looksDirectory = haystack.includes('namekey') || haystack.includes('directories');
  const looksDocument = haystack.includes('titlekey') || haystack.includes('documents');

  // Si apunta a los dos, o a ninguno, no se adivina: se emite el error sin `code` y la interfaz
  // enseña el mensaje genérico. Inventar un `code` sería peor que no darlo.
  if (looksDirectory === looksDocument) {
    return null;
  }

  return looksDirectory ? 'directory' : 'document';
}

/** Cuerpo de la excepción: el filtro global lo convierte en `ErrorResponseDto`. */
function body(message: string, code?: WorkspaceErrorCode): Record<string, unknown> {
  return { message, ...(code === undefined ? {} : { code }) };
}

function conflictOfUniqueIndex(resource: WorkspaceResource | null): HttpException {
  if (resource === 'directory') {
    return new ConflictException(
      body('Ya existe un directorio con ese nombre en la misma carpeta.', 'DIRECTORY_NAME_TAKEN'),
    );
  }

  if (resource === 'document') {
    return new ConflictException(
      body('Ya existe un documento con ese título en la misma carpeta.', 'DOCUMENT_TITLE_TAKEN'),
    );
  }

  // Una violación de índice único **es** un conflicto, sepamos o no de cuál: el `409` es correcto
  // aunque falte el `code`. Aquí sí sería un error degradarlo a un `500`.
  return new ConflictException(body('El nombre ya está en uso.'));
}

function notFoundOfMissingRecord(resource: WorkspaceResource | null): HttpException {
  if (resource === 'directory') {
    return new NotFoundException(body('El directorio no existe.', 'DIRECTORY_NOT_FOUND'));
  }

  if (resource === 'document') {
    return new NotFoundException(body('El documento no existe.', 'DOCUMENT_NOT_FOUND'));
  }

  return new NotFoundException(body('El recurso no existe.'));
}

/**
 * Traduce un error de Prisma y **lanza**: o el `HttpException` equivalente, o el error original tal
 * cual si no lo reconoce.
 *
 * Devuelve `never` a propósito: el uso es `catch (error) { toWorkspaceHttpException(error); }` y
 * así el compilador sabe que la rama termina ahí. Si en su lugar devolviera la excepción, cada
 * llamante tendría que acordarse de relanzar lo no reconocido, que es justo el olvido que hunde la
 * garantía «un 500 no se disfraza de 409».
 */
export function toWorkspaceHttpException(error: unknown): never {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) {
    throw error;
  }

  switch (error.code) {
    case P2002_UNIQUE_VIOLATION:
      throw conflictOfUniqueIndex(resourceOf(error.meta));

    case P2003_FOREIGN_KEY_VIOLATION:
      // La clave ajena solo puede fallar por el padre: si saltó es porque el directorio de destino
      // dejó de existir entre la comprobación y la escritura. Para el cliente eso **es** «el padre
      // no existe», y por eso es un 404 y no un 409.
      throw new NotFoundException(
        body('El directorio de destino no existe o no es tuyo.', 'PARENT_NOT_FOUND'),
      );

    case P2025_RECORD_NOT_FOUND:
      // El `where` de toda escritura lleva el `userId` del token, así que «no existe» y «no es
      // tuyo» son la misma rama: 404 en los dos casos, nunca 403 (decisión 9).
      throw notFoundOfMissingRecord(resourceOf(error.meta));

    case P2034_WRITE_CONFLICT:
      throw new ConflictException(
        body(
          'Otra operación modificó el árbol a la vez. Vuelve a intentarlo.',
          'WORKSPACE_CONFLICT',
        ),
      );

    default:
      throw error;
  }
}
