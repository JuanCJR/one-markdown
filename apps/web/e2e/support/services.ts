import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import net from 'node:net';

import { DATABASE_URL, REDIS_URL } from './dev-env';
import { E2E_EMAIL_PREFIX } from './session';

/**
 * Limpieza de Postgres y Redis alrededor de la suite e2e.
 *
 * Por qué hace falta: en CI el paso de e2e del API corre **antes** que éste, sobre el mismo Redis,
 * la misma base y desde la misma IP, y satura a propósito el rate limit por IP (`register` 5/15 min,
 * `login` 10/min). Sin poner los contadores a cero, el primer registro de esta suite recibiría un
 * `429` intermitente y parecería un fallo de la interfaz. En local el efecto es el mismo entre
 * ejecuciones seguidas de esta propia suite.
 *
 * Nada de `FLUSHALL` ni `FLUSHDB`: en local ese Redis es el de desarrollo y tiene sesiones `auth:*`
 * que no son nuestras. Todo se borra por prefijo o por clave exacta.
 *
 * Se habla con los servicios por TCP y por `psql` y no con un cliente de librería porque `apps/web`
 * no depende de ninguno, y limpiar el entorno de una suite no justifica añadir dependencias.
 */

/** Correos que crea la suite. El dominio `example.test` es reservado: no puede ser de nadie real. */
const E2E_EMAIL_PATTERN = `${E2E_EMAIL_PREFIX}%@example.test`;

const REDIS_TIMEOUT_MS = 5_000;

/**
 * Borra las claves que casan con un patrón, contándolas. `KEYS` y no `SCAN` porque es un script
 * atómico contra una base de desarrollo con pocas claves.
 */
const DELETE_BY_PATTERN = `
local removed = 0
for _, key in ipairs(redis.call('KEYS', ARGV[1])) do
  redis.call('DEL', key)
  removed = removed + 1
end
return removed
`;

function encodeCommand(args: readonly string[]): string {
  return args.reduce(
    (encoded, arg) => `${encoded}$${String(Buffer.byteLength(arg))}\r\n${arg}\r\n`,
    `*${String(args.length)}\r\n`,
  );
}

/** Manda un comando y devuelve la primera línea de la respuesta RESP, sin su marca de tipo. */
async function redisCommand(args: readonly string[]): Promise<string> {
  const url = new URL(REDIS_URL);

  return new Promise<string>((resolve, reject) => {
    const socket = net.createConnection({
      host: url.hostname,
      port: url.port === '' ? 6379 : Number(url.port),
    });

    let buffer = '';

    const settle = (report: () => void): void => {
      socket.destroy();
      report();
    };

    socket.setTimeout(REDIS_TIMEOUT_MS);
    socket.on('timeout', () => {
      settle(() => {
        reject(new Error(`Redis no respondió en ${String(REDIS_TIMEOUT_MS)} ms`));
      });
    });
    socket.on('error', (cause) => {
      settle(() => {
        reject(cause);
      });
    });
    socket.on('connect', () => {
      socket.write(encodeCommand(args));
    });
    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      const lineEnd = buffer.indexOf('\r\n');

      if (lineEnd === -1) {
        return;
      }

      const line = buffer.slice(0, lineEnd);

      settle(() => {
        if (line.startsWith('-')) {
          reject(new Error(`Redis rechazó ${String(args[0])}: ${line.slice(1)}`));

          return;
        }

        resolve(line.slice(1));
      });
    });
  });
}

/**
 * `-q` importa: sin él psql añade la etiqueta del comando (`DELETE 2`) a la salida de un `RETURNING`
 * y esa línea se colaría entre las filas. `-w` para que nunca se quede esperando una contraseña que
 * ya viaja en la URL.
 */
function psql(sql: string): string {
  return execFileSync(
    'psql',
    [DATABASE_URL, '-w', '-q', '-v', 'ON_ERROR_STOP=1', '-At', '-F', '|', '-c', sql],
    {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
}

function describe(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/** Contadores de rate limit por IP. Su namespace es propio (`throttle:`), nunca `auth:`. */
async function resetThrottleCounters(): Promise<void> {
  const removed = await redisCommand(['EVAL', DELETE_BY_PATTERN, '0', 'throttle:*']);

  console.warn(`[e2e] contadores de rate limit borrados: ${removed}`);
}

/**
 * Pone a cero el contador por IP de **un** throttler antes de un caso que va a gastarlo (AC-35).
 *
 * Por qué hace falta, con las cifras medidas: `register` admite **5 altas por IP cada 15 min** y
 * `login` **10 entradas por minuto**. Una ejecución limpia de esta suite gastaba **exactamente 5**
 * altas, así que con `retries: 2` —la configuración de CI— el primer reintento pedía la sexta y
 * recibía un `429`. Y con la suite entera agotando reintentos, las entradas se van igual de arriba:
 * cada caso del smoke abre la suya (3 casos × 3 intentos = 9) y el flujo de auth vuelve a entrar en
 * cada intento (3 más) — 12 contra un cupo de 10. En los dos casos el rojo no tiene nada que ver
 * con lo que la suite mide y aparece justo cuando algo ya había ido mal. Con el contador a cero por
 * caso, el número de reintentos deja de decidir si la suite pasa.
 *
 * **Lo que esto cuesta, escrito aquí a propósito**: al neutralizar esos contadores, la suite de
 * navegador **deja de poder detectar** los límites de alta y de entrada. Se acepta porque quien los
 * verifica es `apps/api/test/auth-throttle.e2e-spec.ts` (AC-20 de la spec 001), que tiene un caso
 * por cada uno: es su sitio, porque un límite **por IP** se prueba contra el API, no a través de un
 * navegador.
 *
 * **No lleves este reset a la suite del API.** Es el atajo obvio el día que aquella suite moleste,
 * y allí destruiría la única prueba de que los límites existen. La regla es sobre el **momento**:
 * poner el contador a cero en los **límites** de un caso hace la prueba determinista; hacerlo a
 * mitad de una secuencia de agotamiento hace que el `429` no llegue nunca. Aquí siempre es lo
 * primero.
 *
 * `mfa` y `refresh` se quedan intactos, y la suite los sigue gastando de verdad.
 */
async function resetThrottleCounter(name: 'register' | 'login' | 'workspace'): Promise<void> {
  try {
    await redisCommand(['EVAL', DELETE_BY_PATTERN, '0', `throttle:${name}:*`]);
  } catch (cause) {
    // Aquí no vale el «best-effort» de `resetDevServices`: sin el reset, el caso que viene detrás
    // puede morir con un `429` que parece un fallo de la interfaz. Mejor fallar diciendo la verdad.
    throw new Error(`No se pudo poner a cero el cupo de ${name} en Redis: ${describe(cause)}`, {
      cause,
    });
  }
}

/** Cupo de altas (`register`: 5 por IP cada 15 min). Ver `resetThrottleCounter`. */
export async function resetRegisterThrottleCounter(): Promise<void> {
  await resetThrottleCounter('register');
}

/** Cupo de entradas (`login`: 10 por IP cada minuto). Ver `resetThrottleCounter`. */
export async function resetLoginThrottleCounter(): Promise<void> {
  await resetThrottleCounter('login');
}

/**
 * Cupo de la superficie del workspace (`workspace`: 120 peticiones por IP cada minuto), a cero antes
 * de un caso que va a gastarlo (AC-34 de la spec `003`).
 *
 * **Las cifras que lo obligan, medidas el 2026-07-28.** Con la suite entera en verde —24 casos,
 * `--repeat-each=3`, sin un solo reintento— el contador de `workspace` llegaba a **98 de 120** en
 * poco menos de veinte segundos, o sea dentro de **una sola** ventana. El margen eran 22 peticiones:
 * menos de lo que cuesta **un** reintento del recorrido del árbol (~13). Y la corrida anterior, con
 * el gasto de antes, ya moría en el tercer repeat con la interfaz enseñando «Demasiadas peticiones
 * desde esta dirección» — un `429` que no tenía nada que ver con lo que el caso medía. Con el
 * contador a cero en los límites de cada caso del editor, el número de reintentos deja de decidir si
 * la suite pasa, que es exactamente lo que ya se hizo con `register` y `login` en la `002`.
 *
 * **Primero se gastó menos, y esto vino después.** Antes de tocar ningún contador se quitó el
 * arranque de la aplicación que dos casos de `editor.spec.ts` hacían solo para tomar prestada la
 * cabecera `Authorization` (ver `session.ts`). Lo que queda por encima del presupuesto es, en su
 * mayor parte, el `GET /api/workspace/documents/:id` **duplicado** que `StrictMode` provoca en cada
 * apertura —el `webServer` de Playwright levanta `pnpm dev`—, y eso no se arregla desde esta suite.
 *
 * **Lo que esto cuesta, escrito aquí a propósito**: la suite de navegador **deja de poder detectar**
 * el límite de la superficie del workspace. Se acepta porque quien lo verifica es
 * `apps/api/test/workspace-throttle.e2e-spec.ts` (AC-24 de la spec `002`), que agota las 120
 * peticiones y exige el `429` —con su forma de `ErrorResponseDto`— en cuatro casos, y que además
 * comprueba que agotar `workspace` no agota `login` ni `documentContent`. Es su sitio: un límite
 * **por IP** se prueba contra el API, no a través de un navegador.
 *
 * **El cupo de `documentContent` NO se resetea**, y es deliberado: la suite entera gasta 4 de sus
 * 120 por corrida, así que neutralizarlo solo restaría cobertura a cambio de nada.
 */
export async function resetWorkspaceThrottleCounter(): Promise<void> {
  await resetThrottleCounter('workspace');
}

interface E2eAccount {
  readonly id: string;
  readonly email: string;
}

/** Borra las cuentas de la suite y devuelve las que había, para poder limpiar sus claves. */
function deleteE2eAccounts(): E2eAccount[] {
  const output = psql(
    `DELETE FROM users WHERE email LIKE '${E2E_EMAIL_PATTERN}' RETURNING id, email`,
  );

  return output
    .split('\n')
    .map((line) => {
      const [id = '', email = ''] = line.split('|');

      return { id, email };
    })
    .filter((account) => account.id !== '' && account.email !== '');
}

/**
 * Claves de Redis de una cuenta de la suite: sesiones (`auth:session:{id}:{sid}`, el índice
 * `auth:sessions:{id}`) y contadores de intentos fallidos, cuya clave es `sha256(correo)`.
 */
async function deleteAccountKeys(account: E2eAccount): Promise<void> {
  await redisCommand(['EVAL', DELETE_BY_PATTERN, '0', `auth:session*:${account.id}*`]);

  const hash = createHash('sha256').update(account.email.trim().toLowerCase()).digest('hex');

  await redisCommand(['DEL', `auth:login:fail:${hash}`, `auth:login:lock:${hash}`]);
}

/**
 * Deja Postgres y Redis como si la suite no hubiera corrido: sin cuentas `e2e-web-*`, sin sus claves
 * y sin contadores de rate limit.
 *
 * Es best-effort a propósito: si `psql` no está instalado o los servicios no responden, avisa y
 * sigue. Un fallo de limpieza no debe teñir de rojo una suite que mide otra cosa, y en CI la base y
 * el Redis son desechables.
 */
export async function resetDevServices(): Promise<void> {
  let accounts: E2eAccount[] = [];

  try {
    accounts = deleteE2eAccounts();
    console.warn(`[e2e] cuentas de prueba borradas: ${String(accounts.length)}`);
  } catch (cause) {
    console.warn(`[e2e] no se pudieron borrar las cuentas de prueba: ${describe(cause)}`);
  }

  try {
    for (const account of accounts) {
      await deleteAccountKeys(account);
    }

    await resetThrottleCounters();
  } catch (cause) {
    console.warn(`[e2e] no se pudieron limpiar las claves de Redis: ${describe(cause)}`);
  }
}
