// Entorno mínimo válido para los e2e. No sobreescribe lo que ya venga definido,
// así CI puede apuntar a sus propios servicios.
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://one_markdown:one_markdown@localhost:5433/one_markdown',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-con-mas-de-32-caracteres',
  JWT_REFRESH_SECRET: 'test-refresh-secret-con-mas-de-32-caracteres',
  // 32 bytes exactos en base64, fijos y sin valor real: los e2e tienen que poder descifrar lo que
  // cifraron en el mismo caso (`Buffer.alloc(32, 7).toString('base64')`).
  MFA_ENCRYPTION_KEY: 'BwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwcHBwc=',
  // bcrypt con coste 12 tarda ~250 ms por hash: en una suite con decenas de registros son minutos.
  // El coste real de producción se verifica aparte, en el test unitario de `PasswordService`.
  BCRYPT_ROUNDS: '4',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
