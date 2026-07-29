import 'reflect-metadata';

import type { ExecutionContext } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';
import { seconds } from '@nestjs/throttler';

import {
  AUTH_THROTTLERS,
  THROTTLE_LIMITS,
  THROTTLE_NAMES,
  Throttled,
  type ThrottleLimit,
  type ThrottleName,
} from './throttle';

/**
 * Configuración de los throttlers nombrados (spec 003, AC-10 — parte de configuración).
 *
 * `throttle.ts` es contrato de la spec `001`: aquí solo se **añade** el throttler `documentContent`
 * del guardado de contenido. Por eso el archivo afirma también, en un caso propio, que los cinco
 * throttlers de `001`/`002` siguen midiendo exactamente lo mismo.
 *
 * El caso que de verdad importa es el último: un `@Throttled('documentContent')` puesto sobre **el
 * manejador** tiene que ganarle al `@Throttled('workspace')` de **la clase**. Eso es lo que permite
 * que `PUT /documents/:id/content` tenga cupo propio sin partir `DocumentsController` en dos
 * (`plan.md` §1.4). Si saliera al revés, el diseño del plan no se sostiene y hay que reportarlo, no
 * inventar un controlador nuevo.
 */

/** Nombre del throttler que añade esta spec. Va como cadena suelta a propósito: antes de que exista
 * en `THROTTLE_NAMES` el test tiene que poder **compilar** y fallar por su aserción, no por el tipo. */
const DOCUMENT_CONTENT = 'documentContent';

/** Los throttlers que ya existían, con su límite exacto. Cambiar cualquiera de estos rompe `001`. */
const HEREDADOS: ReadonlyArray<readonly [string, ThrottleLimit]> = [
  ['register', { limit: 5, ttlSeconds: 900 }],
  ['login', { limit: 10, ttlSeconds: 60 }],
  ['mfa', { limit: 10, ttlSeconds: 60 }],
  ['refresh', { limit: 60, ttlSeconds: 60 }],
  ['workspace', { limit: 120, ttlSeconds: 60 }],
];

/** Vistas ensanchadas de las constantes: leerlas por `string` es lo que hace que este archivo
 * compile antes y después del GREEN, sin una sola aserción de tipo. */
const nombres: readonly string[] = THROTTLE_NAMES;
const limites: Readonly<Record<string, ThrottleLimit | undefined>> = THROTTLE_LIMITS;

/**
 * Convierte una cadena en `ThrottleName` comprobándolo contra `THROTTLE_NAMES`, que es la única
 * fuente de verdad. Si el nombre no está declarado, revienta con un mensaje que dice qué falta —que
 * es justo el rojo esperado antes de implementar— en vez de colarse con una aserción de tipo.
 */
function throttleName(candidato: string): ThrottleName {
  const encontrado = THROTTLE_NAMES.find((name) => name === candidato);

  if (encontrado === undefined) {
    throw new Error(
      `El throttler '${candidato}' no está en THROTTLE_NAMES (${THROTTLE_NAMES.join(', ')}).`,
    );
  }

  return encontrado;
}

/**
 * Un `ExecutionContext` de verdad —el mismo `ExecutionContextHost` que Nest le pasa al guard— sobre
 * un controlador falso decorado a dos niveles. No se doblan ni el `Reflector` ni los metadatos: lo
 * que se mide es la resolución real.
 */
function contextoDeclarando(enElManejador: string, enLaClase: string): ExecutionContext {
  const throttlerDelManejador = throttleName(enElManejador);
  const throttlerDeLaClase = throttleName(enLaClase);

  @Throttled(throttlerDeLaClase)
  class FakeDocumentsController {
    @Throttled(throttlerDelManejador)
    saveContent(): void {
      throw new Error('no se invoca: de este manejador solo se leen sus metadatos');
    }
  }

  return new ExecutionContextHost(
    [],
    FakeDocumentsController,
    FakeDocumentsController.prototype.saveContent,
  );
}

/** El mismo contexto, pero declarando **solo** en la clase. */
function contextoSoloEnLaClase(enLaClase: string): ExecutionContext {
  const throttlerDeLaClase = throttleName(enLaClase);

  @Throttled(throttlerDeLaClase)
  class FakeWorkspaceController {
    getTree(): void {
      throw new Error('no se invoca: de este manejador solo se leen sus metadatos');
    }
  }

  return new ExecutionContextHost(
    [],
    FakeWorkspaceController,
    FakeWorkspaceController.prototype.getTree,
  );
}

/**
 * Los throttlers que **de verdad** se aplican a una petición: los que su `skipIf` no salta. Es la
 * superficie pública por la que se observa `declaredThrottler`, que es privado del módulo. Que la
 * lista tenga exactamente un elemento forma parte de lo que se afirma: dos throttlers activos a la
 * vez significarían que una ruta consume dos cupos.
 */
function throttlersAplicados(context: ExecutionContext): Array<string | undefined> {
  return AUTH_THROTTLERS.filter((throttler) => throttler.skipIf?.(context) === false).map(
    (throttler) => throttler.name,
  );
}

describe('throttle — configuración de los throttlers nombrados (AC-10)', () => {
  it('THROTTLE_NAMES incluye documentContent', () => {
    expect(nombres).toContain(DOCUMENT_CONTENT);
  });

  it('documentContent son 120 guardados por minuto', () => {
    expect(limites[DOCUMENT_CONTENT]).toEqual({ limit: 120, ttlSeconds: 60 });
  });

  it.each(HEREDADOS)('el throttler heredado %s sigue midiendo lo mismo', (nombre, limite) => {
    expect(limites[nombre]).toEqual(limite);
  });

  it('AUTH_THROTTLERS tiene una entrada por nombre, con su límite y su ttl en milisegundos', () => {
    expect(AUTH_THROTTLERS.map((throttler) => throttler.name)).toEqual([...THROTTLE_NAMES]);

    expect(
      AUTH_THROTTLERS.map((throttler) => ({
        name: throttler.name,
        limit: throttler.limit,
        ttl: throttler.ttl,
      })),
    ).toEqual(
      THROTTLE_NAMES.map((name) => ({
        name,
        limit: THROTTLE_LIMITS[name].limit,
        ttl: seconds(THROTTLE_LIMITS[name].ttlSeconds),
      })),
    );
  });

  describe('resolución del throttler declarado', () => {
    it('el @Throttled del manejador gana al de la clase (plan.md §1.4)', () => {
      const context = contextoDeclarando(DOCUMENT_CONTENT, 'workspace');

      expect(throttlersAplicados(context)).toEqual([DOCUMENT_CONTENT]);
    });

    it('sin declaración en el manejador, se aplica el de la clase', () => {
      const context = contextoSoloEnLaClase('workspace');

      expect(throttlersAplicados(context)).toEqual(['workspace']);
    });
  });
});
