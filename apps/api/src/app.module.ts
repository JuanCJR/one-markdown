import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, type ThrottlerModuleOptions, ThrottlerModule } from '@nestjs/throttler';

import { AuthModule } from './auth/auth.module';
import { RedisThrottlerStorage } from './auth/redis-throttler.storage';
import {
  AUTH_THROTTLERS,
  THROTTLE_ERROR_MESSAGE,
  throttleKey,
  throttleTracker,
} from './common/throttle';
import { validateEnv } from './config/env.validation';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { RedisService } from './redis/redis.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      validate: validateEnv,
    }),
    PrismaModule,
    RedisModule,
    // El rate limit se configura aquí y no en `AuthModule` porque el guard es global: `HealthModule`
    // necesita poder saltárselo, y cualquier módulo futuro tiene que quedar fuera por defecto.
    // `RedisModule` es `@Global`, así que el factory recibe el mismo cliente que usan las sesiones.
    ThrottlerModule.forRootAsync({
      inject: [RedisService],
      useFactory: (redis: RedisService): ThrottlerModuleOptions => ({
        throttlers: AUTH_THROTTLERS,
        storage: new RedisThrottlerStorage(redis),
        getTracker: throttleTracker,
        generateKey: throttleKey,
        errorMessage: THROTTLE_ERROR_MESSAGE,
      }),
    }),
    HealthModule,
    AuthModule,
  ],
  providers: [
    // Global: un endpoint nuevo de auth que se olvide de limitar sería un agujero silencioso. Los
    // throttlers son opt-in por ruta (`@Throttled`), así que ser global no impone límites a nadie más.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
