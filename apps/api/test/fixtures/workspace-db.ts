import { ConfigModule } from '@nestjs/config';
import { Test, type TestingModule } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';

import { validateEnv } from '../../src/config/env.validation';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { PrismaService } from '../../src/prisma/prisma.service';
import { WorkspaceRepository } from '../../src/workspace/workspace.repository';

/**
 * Andamiaje del test del repositorio del workspace **contra la base real**.
 *
 * Vive en `test/fixtures/` y no en `src/workspace/` por una razón concreta: dentro del módulo,
 * el repositorio es el único archivo autorizado a nombrar el cliente de base de datos
 * (`workspace-data-access.spec.ts`), y el andamiaje necesita crear usuarios y leer columnas
 * derivadas que ningún método del repositorio expone. Sacarlo del módulo mantiene la regla de capa
 * intacta y, de paso, hace que la comprobación del invariante `parentScopeId` se haga leyendo la
 * base, no preguntándole al mismo código que la escribió.
 *
 * La configuración se carga como en producción (`validateEnv`): en local sale de `apps/api/.env` y
 * en CI de las variables del job. Ningún valor va escrito aquí.
 */

/** Fila cruda de `directories`, con las columnas derivadas que ningún DTO expone. */
export interface DirectoryDbRow {
  readonly id: string;
  readonly userId: string;
  readonly parentId: string | null;
  readonly parentScopeId: string;
  readonly name: string;
  readonly nameKey: string;
}

/**
 * Fila cruda de `documents`.
 *
 * Trae `content`, `contentVersion` y `updatedAt` además de las columnas derivadas porque el guardado
 * de contenido (spec 003, AC-5) afirma algo más fuerte que «no se guardó»: afirma que con una versión
 * rancia —o con el `scope` de otro usuario— la fila **no cambia en absoluto**. Sin `updatedAt` aquí,
 * un `updateMany` que sí tocara la fila y solo acertara a dejar el mismo `content` pasaría inadvertido.
 */
export interface DocumentDbRow {
  readonly id: string;
  readonly userId: string;
  readonly directoryId: string | null;
  readonly parentScopeId: string;
  readonly title: string;
  readonly titleKey: string;
  readonly content: string;
  readonly contentBytes: number;
  readonly contentVersion: number;
  readonly updatedAt: Date;
}

export interface WorkspaceDbContext {
  /** El sujeto bajo test. */
  readonly repository: WorkspaceRepository;
  /** Crea un usuario y devuelve su id. Se borra solo al cerrar el contexto (cascada). */
  createUser: () => Promise<string>;
  /** Todas las filas de workspace de un usuario, leídas directamente de la base. */
  allRowsOf: (
    userId: string,
  ) => Promise<{ directories: DirectoryDbRow[]; documents: DocumentDbRow[] }>;
  close: () => Promise<void>;
}

export async function createWorkspaceDbContext(): Promise<WorkspaceDbContext> {
  const moduleRef: TestingModule = await Test.createTestingModule({
    imports: [
      ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
      PrismaModule,
    ],
    providers: [WorkspaceRepository],
  }).compile();

  await moduleRef.init();

  const prisma = moduleRef.get(PrismaService);
  const repository = moduleRef.get(WorkspaceRepository);
  const createdUserIds: string[] = [];

  return {
    repository,

    createUser: async (): Promise<string> => {
      const user = await prisma.user.create({
        data: {
          // Único por proceso y por llamada: varias suites corren contra la misma base.
          email: `workspace-repo-${String(process.pid)}-${randomUUID()}@example.test`,
          passwordHash: 'sin-uso-en-este-test',
        },
        select: { id: true },
      });

      createdUserIds.push(user.id);

      return user.id;
    },

    allRowsOf: async (userId: string) => {
      const [directories, documents] = await Promise.all([
        prisma.directory.findMany({
          where: { userId },
          select: {
            id: true,
            userId: true,
            parentId: true,
            parentScopeId: true,
            name: true,
            nameKey: true,
          },
          orderBy: { id: 'asc' },
        }),
        prisma.document.findMany({
          where: { userId },
          select: {
            id: true,
            userId: true,
            directoryId: true,
            parentScopeId: true,
            title: true,
            titleKey: true,
            content: true,
            contentBytes: true,
            contentVersion: true,
            updatedAt: true,
          },
          orderBy: { id: 'asc' },
        }),
      ]);

      return { directories, documents };
    },

    close: async (): Promise<void> => {
      // La cascada de `onDelete: Cascade` se lleva directorios y documentos del usuario.
      await prisma.user.deleteMany({ where: { id: { in: createdUserIds } } });
      await moduleRef.close();
    },
  };
}
