import { ApiError } from '../../shared/api/http';

function formatWait(seconds: number): string {
  if (seconds < 60) {
    return `${String(Math.max(1, Math.ceil(seconds)))} segundos`;
  }

  const minutes = Math.ceil(seconds / 60);

  return minutes === 1 ? '1 minuto' : `${String(minutes)} minutos`;
}

/**
 * Traduce un fallo del cliente HTTP al texto que se le muestra a la persona.
 *
 * Los mensajes de `401` del login son deliberadamente idénticos para contraseña incorrecta y correo
 * inexistente, así que aquí se reenvían tal cual: distinguirlos en el cliente reabriría la
 * enumeración de cuentas que el backend cerró.
 */
export function describeAuthError(cause: unknown): string {
  if (!(cause instanceof ApiError)) {
    return 'Ocurrió un error inesperado. Inténtalo de nuevo.';
  }

  if (cause.statusCode === 0) {
    return 'No se pudo contactar con el servidor. Revisa tu conexión e inténtalo de nuevo.';
  }

  if (cause.statusCode === 429 && cause.retryAfterSeconds !== null) {
    return `Demasiados intentos. Vuelve a probar en ${formatWait(cause.retryAfterSeconds)}.`;
  }

  return cause.message;
}
