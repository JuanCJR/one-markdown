// Entorno mínimo válido para los e2e. No sobreescribe lo que ya venga definido,
// así CI puede apuntar a sus propios servicios.
const defaults: Record<string, string> = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://one_markdown:one_markdown@localhost:5433/one_markdown',
  REDIS_URL: 'redis://localhost:6379',
  JWT_ACCESS_SECRET: 'test-access-secret-con-mas-de-32-caracteres',
  JWT_REFRESH_SECRET: 'test-refresh-secret-con-mas-de-32-caracteres',
};

for (const [key, value] of Object.entries(defaults)) {
  process.env[key] ??= value;
}
