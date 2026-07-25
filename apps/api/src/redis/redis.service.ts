import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

import type { AppConfig } from '../config/env.validation';

/**
 * Cliente Redis directo (no cache-manager): la spec 001-auth guardará aquí refresh tokens y
 * contadores de rate limit, que necesitan comandos crudos.
 * `lazyConnect` evita que un Redis caído impida arrancar el proceso; el readiness es quien lo reporta.
 */
@Injectable()
export class RedisService implements OnModuleDestroy {
  readonly client: Redis;

  constructor(config: ConfigService<AppConfig, true>) {
    // `enableOfflineQueue` se deja en su valor por defecto (true) a propósito: con `lazyConnect`,
    // desactivarlo rechaza el primer comando antes de que la conexión llegue a establecerse.
    // El tope de tiempo lo pone el probe del readiness, no ioredis.
    this.client = new Redis(config.get('REDIS_URL', { infer: true }), {
      lazyConnect: true,
      connectTimeout: 2000,
      maxRetriesPerRequest: 1,
    });

    // Sin listener, un fallo de conexión emitiría un 'error' no manejado y tumbaría el proceso.
    this.client.on('error', () => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  /** Comprobación de conectividad para el readiness. Lanza si Redis no responde. */
  async ping(): Promise<string> {
    return this.client.ping();
  }
}
