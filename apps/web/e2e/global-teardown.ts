import { resetDevServices } from './support/services';

/**
 * La suite no deja rastro: las cuentas que creó, sus claves de sesión y los contadores de rate limit
 * que gastó se borran también al terminar. En local esa base y ese Redis son los de desarrollo.
 */
export default async function globalTeardown(): Promise<void> {
  await resetDevServices();
}
