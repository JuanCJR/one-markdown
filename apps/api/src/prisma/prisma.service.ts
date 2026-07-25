import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';

import type { AppConfig } from '../config/env.validation';
import { PrismaClient } from '../generated/prisma/client';

/**
 * Prisma 7 exige un driver adapter: sin él, `new PrismaClient()` lanza P2038.
 * La conexión se abre y se cierra con el ciclo de vida de Nest para no dejar sockets colgando
 * entre tests.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor(config: ConfigService<AppConfig, true>) {
    super({
      adapter: new PrismaPg({ connectionString: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Comprobación de conectividad para el readiness. Lanza si la base no responde. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
