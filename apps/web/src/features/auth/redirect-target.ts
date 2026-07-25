/**
 * Lee el destino que `RequireAuth` guardó en el `state` de la navegación.
 *
 * Solo se aceptan rutas internas: un `from` que empiece por `//` o por un esquema sería un open
 * redirect regalado a quien controle el enlace. Y volver a `/login` o `/register` después de
 * autenticarse sería un bucle, así que también caen a la raíz.
 */
export function readRedirectTarget(state: unknown): string {
  if (typeof state !== 'object' || state === null || !('from' in state)) {
    return '/';
  }

  const { from } = state;

  if (typeof from !== 'string' || !from.startsWith('/') || from.startsWith('//')) {
    return '/';
  }

  if (from === '/login' || from === '/register') {
    return '/';
  }

  return from;
}
