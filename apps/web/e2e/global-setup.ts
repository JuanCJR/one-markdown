import { resetDevServices } from './support/services';
import { ensureSharedAccount } from './support/session';

/**
 * Terreno limpio antes de la primera prueba: sin cuentas `e2e-web-*` de ejecuciones anteriores y con
 * los contadores de rate limit por IP a cero (en CI los gasta el e2e del API, que corre antes sobre
 * el mismo Redis y desde la misma IP).
 *
 * Y con la cuenta compartida ya creada. El orden importa —`resetDevServices` es justo quien la
 * borra— y hacerlo aquí, una sola vez, es lo que evita que cada caso del smoke gaste un alta del
 * cupo de cinco por IP (AC-35). El porqué completo está en `support/session.ts`.
 */
export default async function globalSetup(): Promise<void> {
  await resetDevServices();
  await ensureSharedAccount();
}
