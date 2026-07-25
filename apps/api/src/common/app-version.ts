import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

let cached: string | undefined;

/**
 * Versión declarada en `apps/api/package.json`.
 * Se lee del disco (y no por `import`) para no alterar el `rootDir` inferido por `nest build`.
 * Se resuelve contra `process.cwd()`, que es siempre `apps/api` tanto en dev como en test y en
 * `node dist/main.js`. Si no se puede leer, se lanza: preferimos fallar a reportar una versión falsa.
 */
export function getAppVersion(): string {
  if (cached !== undefined) {
    return cached;
  }

  const path = resolve(process.cwd(), 'package.json');
  const parsed: unknown = JSON.parse(readFileSync(path, 'utf8'));

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('version' in parsed) ||
    typeof parsed.version !== 'string' ||
    parsed.version.length === 0
  ) {
    throw new Error(`No se pudo leer una versión válida desde ${path}`);
  }

  cached = parsed.version;
  return cached;
}
