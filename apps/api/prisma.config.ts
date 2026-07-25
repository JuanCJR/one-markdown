// Prisma 7 lee la configuración desde este archivo, no desde `env()` dentro de schema.prisma.
import { defineConfig, env } from 'prisma/config';

export default defineConfig({
  schema: 'prisma/schema.prisma',
  datasource: {
    url: env('DATABASE_URL'),
  },
});
