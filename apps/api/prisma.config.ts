// Prisma 7 lee la configuración desde este archivo, no desde `env()` dentro de schema.prisma.
// El `import 'dotenv/config'` es obligatorio: Prisma 7 dejó de cargar `.env` de forma implícita y sin
// él el CLI falla con `PrismaConfigEnvError: Cannot resolve environment variable: DATABASE_URL`.
import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
