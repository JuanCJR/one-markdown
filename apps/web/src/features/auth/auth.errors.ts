import { ApiError } from '../../shared/api/http';
import { cuentaBloqueada, ERRORES } from '../../shared/textos/textos';

/**
 * Traduce un fallo del cliente HTTP al texto que se le muestra a la persona.
 *
 * **El cliente traduce; el servidor ya no habla en pantalla.** Hasta la fase 6 tres mensajes del
 * backend se reenviaban tal cual —«Credenciales inválidas», «Demasiados intentos fallidos…»,
 * «Demasiadas peticiones desde esta dirección…»— y eso repartía la voz del producto entre dos
 * repositorios: cualquier retoque de redacción en el API cambiaba lo que lee la persona sin pasar
 * por diseño. Ahora se mapea por **código de estado** y por la presencia de `retryAfterSeconds`, que
 * es lo que el contrato garantiza (`docs/design/06-marca.md` §4, regla 15).
 *
 * Los mensajes de `401` del login son deliberadamente idénticos para contraseña incorrecta y correo
 * inexistente, y la cadena única lo mantiene: distinguirlos reabriría la enumeración de cuentas que
 * el backend cerró.
 */

/**
 * Desde dónde se pregunta, porque un `401` no significa lo mismo en los dos sitios.
 *
 * - `credenciales`: el formulario de entrar o el de crear el archivo. Un `401` es «el correo o la
 *   contraseña no coinciden», y esa es la frase.
 * - `sesionAbierta`: la pantalla de seguridad, donde la persona **ya** está dentro. Un `401` ahí es
 *   el servidor diciendo que el dato que acaba de teclear —su contraseña o su código de seis
 *   dígitos— no vale, y quién de los dos es lo sabe el backend. Su mensaje se reenvía porque el
 *   nuestro sería más pobre.
 */
export type ContextoAuth = 'credenciales' | 'sesionAbierta';

export function describeAuthError(
  cause: unknown,
  contexto: ContextoAuth = 'sesionAbierta',
): string {
  if (!(cause instanceof ApiError)) {
    return ERRORES.desconocido;
  }

  if (cause.statusCode === 0) {
    return ERRORES.sinServidor;
  }

  // Los dos `429` no son el mismo hecho y no pueden decir lo mismo. `retryAfterSeconds` solo lo trae
  // el bloqueo de **una cuenta** (`AccountLockedException`); el límite por IP del throttler llega
  // sin él. Distinguirlos por ahí, y no por el texto del mensaje, es lo que hace que un retoque de
  // redacción en el backend no cambie de rama en silencio.
  if (cause.statusCode === 429) {
    return cause.retryAfterSeconds === null
      ? ERRORES.demasiadasPeticiones
      : cuentaBloqueada(cause.retryAfterSeconds);
  }

  if (cause.statusCode === 401 && contexto === 'credenciales') {
    return ERRORES.credenciales;
  }

  return cause.message;
}
