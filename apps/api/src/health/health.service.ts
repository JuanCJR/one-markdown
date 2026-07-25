import { Injectable } from '@nestjs/common';

import { getAppVersion } from '../common/app-version';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { HealthResponseDto } from './dto/health.response.dto';
import { type CheckState, ReadinessChecksDto, ReadinessResponseDto } from './dto/readiness.response.dto';

/** Un check colgado es un check caído: sin tope, el readiness se quedaría esperando al operador. */
const CHECK_TIMEOUT_MS = 2000;

async function probe(run: () => Promise<unknown>): Promise<CheckState> {
  let timer: NodeJS.Timeout | undefined;

  try {
    await Promise.race([
      run(),
      new Promise((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error('timeout')), CHECK_TIMEOUT_MS);
      }),
    ]);

    return 'up';
  } catch {
    return 'down';
  } finally {
    if (timer !== undefined) {
      clearTimeout(timer);
    }
  }
}

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /** Liveness: no toca I/O, para que la caída de una dependencia no provoque reinicios en cascada. */
  liveness(): HealthResponseDto {
    return new HealthResponseDto({
      uptimeSeconds: Math.round(process.uptime()),
      version: getAppVersion(),
    });
  }

  async readiness(): Promise<ReadinessResponseDto> {
    const [database, redis] = await Promise.all([
      probe(() => this.prisma.ping()),
      probe(() => this.redis.ping()),
    ]);

    return new ReadinessResponseDto(new ReadinessChecksDto({ database, redis }));
  }
}
