import { randomBytes } from 'node:crypto';

import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';

import type { AppConfig } from '../config/env.validation';

/**
 * Hash y verificación de contraseñas. El coste sale de `BCRYPT_ROUNDS` (12 en producción, 4 en tests)
 * para que la suite no pague ~250 ms por hash sin aflojar la protección real.
 */
@Injectable()
export class PasswordService {
  private readonly rounds: number;
  /**
   * Hash de una contraseña aleatoria que nadie conoce, generado una vez por proceso.
   * Existe para gastar el mismo tiempo cuando el correo no existe: sin él, la respuesta llega antes
   * y el tiempo delata qué cuentas están registradas (decisión 9 de specs/001-auth/plan.md).
   */
  private readonly decoyHash: string;

  constructor(config: ConfigService<AppConfig, true>) {
    this.rounds = config.get('BCRYPT_ROUNDS', { infer: true });
    this.decoyHash = bcrypt.hashSync(randomBytes(32).toString('hex'), this.rounds);
  }

  async hash(plain: string): Promise<string> {
    return bcrypt.hash(plain, this.rounds);
  }

  /**
   * `false` en vez de excepción cuando el hash almacenado no es válido: un dato corrupto en la fila
   * es un fallo de credenciales, no un 500 que además revelaría que el usuario existe.
   */
  async compare(plain: string, hash: string): Promise<boolean> {
    try {
      return await bcrypt.compare(plain, hash);
    } catch {
      return false;
    }
  }

  /** Siempre `false`, pero después de gastar un bcrypt real. Para el caso "el correo no existe". */
  async compareWithDecoy(plain: string): Promise<false> {
    await this.compare(plain, this.decoyHash);
    return false;
  }
}
