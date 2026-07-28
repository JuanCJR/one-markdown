import { ConflictException } from '@nestjs/common';

import { WorkspaceDomainError } from './workspace.errors';

/**
 * Traducción de los errores **de dominio** del workspace a HTTP, en un solo sitio.
 *
 * Es la pieza simétrica de `prisma-error.ts`: aquélla traduce lo que solo puede detectar la base
 * (índices únicos, claves ajenas, conflictos de serialización), ésta traduce lo que decide el
 * dominio puro antes de escribir (ciclo, profundidad, tope de nodos). Las dos comparten la misma
 * regla de oro: **lo que no se reconoce se propaga sin tocar**, para que un fallo real nunca salga
 * disfrazado de error de negocio.
 *
 * Todos los errores de dominio son `409`: describen una operación que el estado actual del árbol no
 * admite, no una petición mal formada (eso lo para el `ValidationPipe`) ni un recurso ausente (eso
 * lo decide el `where` con `userId` y sale como `404`).
 */
export function toWorkspaceDomainHttpException(error: unknown): never {
  if (error instanceof WorkspaceDomainError) {
    // El `code` viaja en el cuerpo porque hay cinco `409` distintos y la interfaz tiene que decir
    // algo distinto en cada uno; emparejar por el texto del mensaje se rompe al primer matiz.
    throw new ConflictException({ message: error.message, code: error.code });
  }

  throw error;
}
