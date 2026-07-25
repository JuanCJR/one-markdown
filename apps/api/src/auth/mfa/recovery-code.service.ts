import { randomInt } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import { PrismaService } from '../../prisma/prisma.service';
import { PasswordService } from '../password.service';

/** Ocho códigos: decisión 7 del plan. Suficientes para varios cambios de teléfono, pocos para auditar. */
export const RECOVERY_CODE_COUNT = 8;
/** Sin `I`, `O`, `0` ni `1`: el usuario los copia a mano de una pantalla y confundirlos cuesta la cuenta. */
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const GROUP_LENGTH = 4;
export const RECOVERY_CODE_PATTERN = /^[A-Z0-9]{4}-[A-Z0-9]{4}$/;

/** Un código recién generado: el claro solo viaja en la respuesta del `enable`; en la base va el hash. */
export interface GeneratedRecoveryCode {
  readonly plain: string;
  readonly hash: string;
}

/**
 * Códigos de recuperación de un solo uso (decisión 7 de specs/001-auth/plan.md, AC-18).
 *
 * Se hashean con bcrypt igual que una contraseña porque **son** una credencial de segundo factor: un
 * dump de la base no debe entregar ocho llaves listas para usar.
 */
@Injectable()
export class RecoveryCodeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  /** Un grupo `XXXX` con `randomInt`, que muestrea sin sesgo (a diferencia de `% ALPHABET.length`). */
  private group(): string {
    let out = '';

    for (let i = 0; i < GROUP_LENGTH; i += 1) {
      out += ALPHABET[randomInt(ALPHABET.length)];
    }

    return out;
  }

  /** Ocho códigos **distintos** con su hash. El claro se devuelve una sola vez y no se persiste. */
  async generate(): Promise<GeneratedRecoveryCode[]> {
    const plain = new Set<string>();

    while (plain.size < RECOVERY_CODE_COUNT) {
      plain.add(`${this.group()}-${this.group()}`);
    }

    return Promise.all(
      [...plain].map(async (code) => ({ plain: code, hash: await this.passwords.hash(code) })),
    );
  }

  /**
   * Gasta un código de recuperación. `true` solo si estaba sin usar y era de este usuario.
   *
   * El sellado va con `updateMany` filtrando por `usedAt: null` y comprobando `count === 1`, no con
   * un `findFirst` + `update`: entre leer y escribir cabe otra petición con el mismo código, y dos
   * usos del mismo código es exactamente lo que AC-18 prohíbe. La base es el árbitro atómico.
   */
  async consume(userId: string, code: string): Promise<boolean> {
    const normalized = code.trim().toUpperCase();
    const candidates = await this.prisma.mfaRecoveryCode.findMany({
      where: { userId, usedAt: null },
      select: { id: true, codeHash: true },
    });

    for (const candidate of candidates) {
      if (!(await this.passwords.compare(normalized, candidate.codeHash))) {
        continue;
      }

      const sealed = await this.prisma.mfaRecoveryCode.updateMany({
        where: { id: candidate.id, usedAt: null },
        data: { usedAt: new Date() },
      });

      return sealed.count === 1;
    }

    return false;
  }
}
