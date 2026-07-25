import { resetDevServices } from './support/services';

/**
 * Terreno limpio antes de la primera prueba: sin cuentas `e2e-web-*` de ejecuciones anteriores y con
 * los contadores de rate limit por IP a cero (en CI los gasta el e2e del API, que corre antes sobre
 * el mismo Redis y desde la misma IP).
 */
export default async function globalSetup(): Promise<void> {
  await resetDevServices();
}
