import { randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client';
import {
  createWorkspaceDbContext,
  type WorkspaceDbContext,
} from '../../test/fixtures/workspace-db';
import { parentScopeIdFor } from './workspace.repository';

/**
 * El repositorio del workspace **contra la base real** (AC-22).
 *
 * No se dobla Prisma: lo único que este archivo tiene que demostrar es que las dos garantías que
 * dependen de la base se cumplen de verdad, y un doble las daría por buenas por definición.
 *
 * 1. **Aislamiento por usuario**: con el `scope` de otro usuario, ni se lee, ni se actualiza, ni se
 *    borra nada. Es la falla más probable de esta app y la que convierte un `404` en una fuga.
 * 2. **`parentScopeId = parentId ?? userId`** en las cuatro combinaciones, comprobado leyendo la
 *    columna de la base (no el objeto que devolvió el método que la escribió).
 *
 * El andamiaje —crear usuarios y leer las columnas derivadas— vive en `test/fixtures/workspace-db`
 * para que el módulo siga teniendo un único archivo que conoce el cliente de base de datos.
 */

const nameOf = (label: string): { name: string; nameKey: string } => ({
  name: label,
  nameKey: label.toLowerCase(),
});

const titleOf = (label: string): { title: string; titleKey: string } => ({
  title: label,
  titleKey: label.toLowerCase(),
});

/** Lo que rechazó la promesa. Falla el test si no rechaza. */
async function captureRejection(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }

  throw new Error('se esperaba que la operación fallara, y se resolvió');
}

/** Comprueba que el repositorio dejó pasar el error nativo de Prisma con ese código. */
function expectPrismaError(error: unknown, code: string): void {
  expect(error).toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
  expect(error instanceof Prisma.PrismaClientKnownRequestError ? error.code : null).toBe(code);
}

describe('WorkspaceRepository (base real)', () => {
  let ctx: WorkspaceDbContext;
  let ownerId: string;
  let intruderId: string;

  beforeAll(async () => {
    ctx = await createWorkspaceDbContext();
  }, 30_000);

  beforeEach(async () => {
    ownerId = await ctx.createUser();
    intruderId = await ctx.createUser();
  });

  afterAll(async () => {
    await ctx.close();
  });

  describe('parentScopeId = parentId ?? userId', () => {
    it('un directorio en la raíz toma el userId como ámbito', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Notas'), parentId: null },
      );

      const { directories } = await ctx.allRowsOf(ownerId);
      const row = directories.find((candidate) => candidate.id === created.id);

      expect(row?.parentScopeId).toBe(ownerId);
      expect(row?.parentId).toBeNull();
      expect(row?.userId).toBe(ownerId);
    });

    it('un directorio anidado toma el id del padre como ámbito', async () => {
      const parent = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Proyectos'), parentId: null },
      );
      const child = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Interno'), parentId: parent.id },
      );

      const { directories } = await ctx.allRowsOf(ownerId);

      expect(directories.find((row) => row.id === child.id)?.parentScopeId).toBe(parent.id);
    });

    it('un documento en la raíz toma el userId como ámbito', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Diario'), directoryId: null, content: '' },
      );

      const { documents } = await ctx.allRowsOf(ownerId);
      const row = documents.find((candidate) => candidate.id === created.id);

      expect(row?.parentScopeId).toBe(ownerId);
      expect(row?.directoryId).toBeNull();
      expect(row?.userId).toBe(ownerId);
    });

    it('un documento anidado toma el id del directorio como ámbito', async () => {
      const directory = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Archivo'), parentId: null },
      );
      const document = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Acta'), directoryId: directory.id, content: '# hola' },
      );

      const { documents } = await ctx.allRowsOf(ownerId);

      expect(documents.find((row) => row.id === document.id)?.parentScopeId).toBe(directory.id);
    });

    it('el invariante se cumple en todas las filas del usuario, no solo en la que mira el caso', async () => {
      const raiz = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Raíz'), parentId: null },
      );
      const hijo = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Hijo'), parentId: raiz.id },
      );
      await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Nieto'), parentId: hijo.id },
      );
      await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Otra raíz'), parentId: null },
      );
      await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Suelto'), directoryId: null, content: '' },
      );
      await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Dentro'), directoryId: hijo.id, content: 'x' },
      );

      const { directories, documents } = await ctx.allRowsOf(ownerId);

      expect(directories).toHaveLength(4);
      expect(documents).toHaveLength(2);

      for (const row of directories) {
        expect(row.parentScopeId).toBe(row.parentId ?? ownerId);
      }

      for (const row of documents) {
        expect(row.parentScopeId).toBe(row.directoryId ?? ownerId);
      }
    });

    it('parentScopeIdFor es el único sitio donde se decide el ámbito', () => {
      const userId = randomUUID();
      const parentId = randomUUID();

      expect(parentScopeIdFor({ userId, parentId: null })).toBe(userId);
      expect(parentScopeIdFor({ userId, parentId })).toBe(parentId);
    });
  });

  describe('aislamiento por usuario: directorios', () => {
    it('no encuentra un directorio ajeno', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Privado'), parentId: null },
      );

      await expect(ctx.repository.findDirectory({ userId: intruderId }, created.id)).resolves.toBeNull();
      await expect(ctx.repository.findDirectory({ userId: ownerId }, created.id)).resolves.not.toBeNull();
    });

    it('no actualiza un directorio ajeno y lo deja intacto', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Privado'), parentId: null },
      );

      expectPrismaError(
        await captureRejection(
          ctx.repository.updateDirectory({ userId: intruderId }, created.id, nameOf('Robado')),
        ),
        'P2025',
      );

      const { directories } = await ctx.allRowsOf(ownerId);

      expect(directories.find((row) => row.id === created.id)?.name).toBe('Privado');
    });

    it('actualiza un directorio propio', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Privado'), parentId: null },
      );

      const updated = await ctx.repository.updateDirectory(
        { userId: ownerId },
        created.id,
        nameOf('Renombrado'),
      );

      expect(updated.name).toBe('Renombrado');

      // La clave de unicidad se escribe pero no sale del repositorio: se comprueba en la base.
      const { directories } = await ctx.allRowsOf(ownerId);

      expect(directories.find((row) => row.id === created.id)?.nameKey).toBe('renombrado');
    });

    it('no deja salir del repositorio las columnas internas (userId, nameKey, parentScopeId)', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Visible'), parentId: null },
      );

      expect(Object.keys(created).sort()).toEqual([
        'createdAt',
        'id',
        'name',
        'parentId',
        'updatedAt',
      ]);
    });

    it('no borra un directorio ajeno', async () => {
      const created = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Privado'), parentId: null },
      );

      await expect(ctx.repository.deleteDirectory({ userId: intruderId }, created.id)).resolves.toBe(
        0,
      );

      const { directories } = await ctx.allRowsOf(ownerId);

      expect(directories).toHaveLength(1);
      await expect(ctx.repository.deleteDirectory({ userId: ownerId }, created.id)).resolves.toBe(1);
      expect((await ctx.allRowsOf(ownerId)).directories).toHaveLength(0);
    });
  });

  describe('aislamiento por usuario: documentos', () => {
    it('no encuentra un documento ajeno', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Secreto'), directoryId: null, content: 'confidencial' },
      );

      await expect(ctx.repository.findDocument({ userId: intruderId }, created.id)).resolves.toBeNull();

      const mine = await ctx.repository.findDocument({ userId: ownerId }, created.id);

      expect(mine?.content).toBe('confidencial');
    });

    it('no actualiza un documento ajeno y lo deja intacto', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Secreto'), directoryId: null, content: '' },
      );

      expectPrismaError(
        await captureRejection(
          ctx.repository.updateDocument({ userId: intruderId }, created.id, titleOf('Robado')),
        ),
        'P2025',
      );

      const { documents } = await ctx.allRowsOf(ownerId);

      expect(documents.find((row) => row.id === created.id)?.title).toBe('Secreto');
    });

    it('no borra un documento ajeno', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Secreto'), directoryId: null, content: '' },
      );

      await expect(ctx.repository.deleteDocument({ userId: intruderId }, created.id)).resolves.toBe(
        0,
      );
      await expect(ctx.repository.deleteDocument({ userId: ownerId }, created.id)).resolves.toBe(1);
    });

    it('persiste contentBytes en bytes UTF-8, no en caracteres', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Multibyte'), directoryId: null, content: 'ñ€' },
      );

      const { documents } = await ctx.allRowsOf(ownerId);

      // 'ñ' son 2 bytes y '€' son 3: 5 bytes para 2 caracteres.
      expect(documents.find((row) => row.id === created.id)?.contentBytes).toBe(5);
      expect(created.contentBytes).toBe(5);
    });

    it('no deja salir del repositorio las columnas internas de un documento', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Visible'), directoryId: null, content: 'hola' },
      );

      expect(Object.keys(created).sort()).toEqual([
        'content',
        'contentBytes',
        'createdAt',
        'directoryId',
        'id',
        'title',
        'updatedAt',
      ]);
    });
  });
});
