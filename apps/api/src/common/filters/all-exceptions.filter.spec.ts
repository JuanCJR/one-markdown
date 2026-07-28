import { HttpException, HttpStatus, Logger } from '@nestjs/common';
import { ExecutionContextHost } from '@nestjs/core/helpers/execution-context-host';

import { AllExceptionsFilter } from './all-exceptions.filter';

/**
 * El filtro global es el único sitio por el que sale un error de la API, así que es también el
 * único sitio donde el `code` de dominio del workspace (decisión 13 del plan de la spec 002) puede
 * llegar al cliente. Sin este paso, `ErrorResponseDto.code` sería un campo documentado en Swagger
 * que nadie rellena nunca.
 *
 * El segundo caso es el que protege a las specs `000` y `001`: el error que **no** trae `code` sigue
 * saliendo con exactamente las cinco claves de siempre, no con una sexta puesta a `null`.
 */

const ERROR_KEYS = ['error', 'message', 'path', 'statusCode', 'timestamp'];

interface CapturedResponse {
  status: number | null;
  body: Record<string, unknown> | null;
  readonly headers: Record<string, string>;
}

function runFilter(exception: unknown): CapturedResponse {
  const captured: CapturedResponse = { status: null, body: null, headers: {} };

  const response = {
    setHeader: (name: string, value: string): void => {
      captured.headers[name] = value;
    },
    status: (code: number) => {
      captured.status = code;

      return {
        // Se guarda lo **serializado**, que es lo que ve el cliente: una propiedad opcional
        // declarada en la clase existe como clave con valor `undefined`, y `JSON.stringify` la
        // omite. Comprobarlo sobre la instancia daría por presente una clave que nunca se emite.
        json: (body: unknown): void => {
          captured.body = JSON.parse(JSON.stringify(body)) as Record<string, unknown>;
        },
      };
    },
  };

  const request = { method: 'POST', originalUrl: '/api/workspace/directories' };

  new AllExceptionsFilter().catch(exception, new ExecutionContextHost([request, response]));

  return captured;
}

describe('AllExceptionsFilter · code de dominio', () => {
  it('propaga al JSON el code que trae la excepción', () => {
    const captured = runFilter(
      new HttpException(
        { message: 'Ya existe un directorio con ese nombre.', code: 'DIRECTORY_NAME_TAKEN' },
        HttpStatus.CONFLICT,
      ),
    );

    expect(captured.status).toBe(HttpStatus.CONFLICT);
    expect(captured.body?.['code']).toBe('DIRECTORY_NAME_TAKEN');
    expect(captured.body?.['error']).toBe('Conflict');
    expect(Object.keys(captured.body ?? {}).sort()).toEqual([...ERROR_KEYS, 'code'].sort());
  });

  it('omite la clave code cuando la excepción no la trae (specs 000 y 001)', () => {
    const captured = runFilter(new HttpException('No autorizado', HttpStatus.UNAUTHORIZED));

    expect(captured.status).toBe(HttpStatus.UNAUTHORIZED);
    expect(Object.keys(captured.body ?? {}).sort()).toEqual(ERROR_KEYS);
  });

  it('ignora un code que no sea string en vez de ensanchar el contrato con basura', () => {
    const captured = runFilter(new HttpException({ message: 'x', code: 42 }, HttpStatus.CONFLICT));

    expect(Object.keys(captured.body ?? {}).sort()).toEqual(ERROR_KEYS);
  });

  it('un error que no es HttpException sigue saliendo como 500 sin code', () => {
    const logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);

    try {
      const captured = runFilter(new Error('la base se cayó'));

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(Object.keys(captured.body ?? {}).sort()).toEqual(ERROR_KEYS);
    } finally {
      logged.mockRestore();
    }
  });
});

/**
 * Spec 002 · AC-33 (y ampliación de AC-5 de la spec `000`, ver su CHANGELOG v0.1.5).
 *
 * Express y body-parser señalan los fallos de protocolo con errores de `http-errors`, que **no** son
 * `HttpException`: el `PayloadTooLargeError` que produce un cuerpo por encima de `JSON_BODY_LIMIT`
 * trae `status: 413` y aun así salía como `500`, con traza completa en el log. O sea: el cliente
 * recibía la única respuesta que le dice «reintenta, no es culpa tuya», y cualquiera con un token
 * válido tenía un generador de ruido en logs y de alertas de `5xx`.
 *
 * La mitad negativa de estos casos es tan importante como la positiva: la traducción **solo** puede
 * confiar en un estado entero en `4xx`. Un `5xx` que reporte una librería sigue siendo un fallo del
 * servidor y tiene que seguir registrándose con traza; un `status` que no sea un entero solo puede
 * venir de un error de programación y no puede decidir el código de respuesta. El caso de arriba
 * («un error que no es HttpException…»), con un `Error` pelado sin `status`, es el que impide que
 * esta traducción se convierta en «cualquier error de librería se disfraza de `4xx`».
 */
describe('AllExceptionsFilter · errores con estado al estilo http-errors (AC-33)', () => {
  /**
   * Un error con propiedades añadidas, que es exactamente la forma que emite `http-errors`: una
   * instancia de `Error` con `status`, `statusCode` y `expose`. Se construye a mano y no se importa
   * la librería: es una transitiva de Express, no una dependencia declarada del proyecto.
   */
  function libraryError(message: string, extra: Record<string, unknown>): Error {
    return Object.assign(new Error(message), extra);
  }

  let logged: jest.SpyInstance;

  beforeEach(() => {
    logged = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    logged.mockRestore();
  });

  it('traduce el PayloadTooLargeError de body-parser a 413 con la forma del DTO de error', () => {
    const captured = runFilter(
      libraryError('request entity too large', {
        status: 413,
        statusCode: 413,
        expose: true,
        type: 'entity.too.large',
        limit: 2_097_152,
      }),
    );

    expect(captured.status).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(captured.body?.['statusCode']).toBe(HttpStatus.PAYLOAD_TOO_LARGE);
    expect(captured.body?.['error']).toBe('Payload Too Large');
    expect(captured.body?.['message']).toBe('request entity too large');
    expect(Object.keys(captured.body ?? {}).sort()).toEqual(ERROR_KEYS);
  });

  it('no registra el 413 como error del servidor: es un fallo del cliente, no una alerta de 5xx', () => {
    runFilter(libraryError('request entity too large', { status: 413, expose: true }));

    expect(logged).not.toHaveBeenCalled();
  });

  it('acepta statusCode además de status (http-errors pone las dos)', () => {
    const captured = runFilter(libraryError('invalid json', { statusCode: 400, expose: true }));

    expect(captured.status).toBe(HttpStatus.BAD_REQUEST);
    expect(captured.body?.['error']).toBe('Bad Request');
    expect(logged).not.toHaveBeenCalled();
  });

  it('un status 5xx de una librería sigue saliendo 500 y sigue registrándose con traza', () => {
    const captured = runFilter(libraryError('upstream caído', { status: 502 }));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body?.['message']).toBe('Error interno del servidor');
    expect(Object.keys(captured.body ?? {}).sort()).toEqual(ERROR_KEYS);
    expect(logged).toHaveBeenCalled();
  });

  it('un status que no es entero no decide el código de respuesta', () => {
    for (const status of ['nope', 413.5, Number.NaN, null, true]) {
      logged.mockClear();

      const captured = runFilter(libraryError('forma rara', { status }));

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
      expect(captured.body?.['message']).toBe('Error interno del servidor');
      expect(logged).toHaveBeenCalled();
    }
  });

  it('un status fuera del rango 4xx tampoco pasa (ni por debajo ni por encima)', () => {
    for (const status of [399, 200, 0, -1, 600]) {
      const captured = runFilter(libraryError('forma rara', { status }));

      expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    }
  });

  it('un Error pelado sin status sigue siendo 500 y sigue registrándose (mitad negativa)', () => {
    const captured = runFilter(new Error('la base se cayó'));

    expect(captured.status).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(captured.body?.['message']).toBe('Error interno del servidor');
    expect(logged).toHaveBeenCalled();
  });

  it('un mensaje que no es texto no se cuela en el cuerpo del 4xx', () => {
    const captured = runFilter(libraryError('ignorado', { status: 418, message: { raro: true } }));

    expect(captured.status).toBe(418);
    expect(captured.body?.['message']).toBe('Error interno del servidor');
  });
});
