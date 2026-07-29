import { randomUUID } from 'node:crypto';

import { Prisma } from '../generated/prisma/client';
import {
  createWorkspaceDbContext,
  type DocumentDbRow,
  type WorkspaceDbContext,
} from '../../test/fixtures/workspace-db';
import { contentBytesOf } from './document-content';
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

/**
 * Espera lo justo para que dos escrituras seguidas caigan en milisegundos distintos.
 *
 * `updatedAt` es `timestamp(3)`: sin esta pausa, «la fila no cambió» y «la fila se reescribió dentro
 * del mismo milisegundo» son indistinguibles, y el caso de la versión rancia pasaría por el motivo
 * equivocado.
 */
const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 20));

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
        'contentVersion',
        'createdAt',
        'directoryId',
        'id',
        'title',
        'updatedAt',
      ]);
    });
  });

  /**
   * Guardado de contenido con concurrencia optimista (spec 003: AC-5 y AC-9 a nivel de datos).
   *
   * Lo que hay que demostrar aquí no es que el camino feliz escriba —eso lo haría cualquier
   * `update`—, sino las tres propiedades de las que depende el mecanismo entero:
   *
   * 1. **La versión es la puerta.** Con una `expectedVersion` que no es la vigente no se escribe
   *    **nada**, y «nada» incluye `updatedAt`: un `updateMany` que no casa no toca la fila, pero eso
   *    es una afirmación sobre PostgreSQL que hay que medir, no dar por hecha.
   * 2. **`userId` va en el mismo `where` que la versión.** Con el `scope` de otro usuario no se
   *    escribe aunque la versión sea la correcta, así que `count: 0` significa las tres cosas a la
   *    vez y la desambiguación `404`/`409` del servicio (spec 003, riesgo #3) nunca puede confirmar
   *    la existencia de un documento ajeno.
   * 3. **Ortogonalidad con renombrar y mover** (AC-9). Es la razón de ser de la columna dedicada:
   *    renombrar y mover **sí** mueven `updatedAt`, así que si el token fuese esa marca de tiempo,
   *    renombrar desde la barra lateral haría fallar un guardado pendiente con un conflicto que no
   *    existe. Los casos de abajo comprueban las dos mitades: que esas operaciones no tocan
   *    `contentVersion`, y que un guardado con la versión leída **antes** del renombrado sigue
   *    entrando.
   */
  describe('guardado de contenido: saveDocumentContent', () => {
    /** La fila de la base, con `content`, `contentVersion` y `updatedAt`. Falla si no existe. */
    const documentRowOf = async (userId: string, id: string): Promise<DocumentDbRow> => {
      const { documents } = await ctx.allRowsOf(userId);
      const row = documents.find((candidate) => candidate.id === id);

      if (row === undefined) {
        throw new Error(`no hay fila de documento ${id} para el usuario ${userId}`);
      }

      return row;
    };

    it('un documento recién creado nace con contentVersion 0', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Nuevo'), directoryId: null, content: 'algo' },
      );

      expect((await documentRowOf(ownerId, created.id)).contentVersion).toBe(0);
    });

    it('con la versión vigente guarda el texto, recalcula contentBytes e incrementa la versión en uno', async () => {
      const directory = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Cuaderno'), parentId: null },
      );
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Acta'), directoryId: directory.id, content: 'inicial' },
      );
      const before = await documentRowOf(ownerId, created.id);

      // 14 unidades UTF-16 y 17 bytes UTF-8: el multibyte y el par suplente hacen que las dos
      // magnitudes no coincidan, que es justo lo que `contentBytesOf` existe para no equivocar.
      const nuevo = '# Hola ñ\r\n- 🙂';

      await tick();

      const saved = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: nuevo,
        expectedVersion: 0,
      });

      expect(saved).not.toBeNull();
      expect(saved === null ? [] : Object.keys(saved).sort()).toEqual([
        'contentBytes',
        'contentVersion',
        'id',
        'updatedAt',
      ]);
      expect(saved?.id).toBe(created.id);
      expect(saved?.contentVersion).toBe(1);
      expect(saved?.contentBytes).toBe(17);
      expect(contentBytesOf(nuevo)).toBe(17);
      expect(nuevo.length).toBe(14);

      const after = await documentRowOf(ownerId, created.id);

      expect(after.content).toBe(nuevo);
      expect(after.contentBytes).toBe(17);
      expect(after.contentVersion).toBe(1);
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
      expect(saved?.updatedAt.getTime()).toBe(after.updatedAt.getTime());

      // Guardar contenido no toca la identidad ni la posición del documento (AC-9).
      expect(after.title).toBe('Acta');
      expect(after.titleKey).toBe('acta');
      expect(after.directoryId).toBe(directory.id);
      expect(after.parentScopeId).toBe(directory.id);
    });

    it('cada guardado exige la versión que devolvió el anterior', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Serie'), directoryId: null, content: '' },
      );

      const primero = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'uno',
        expectedVersion: 0,
      });

      expect(primero?.contentVersion).toBe(1);

      const segundo = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'dos',
        expectedVersion: primero?.contentVersion ?? -1,
      });

      expect(segundo?.contentVersion).toBe(2);

      const after = await documentRowOf(ownerId, created.id);

      expect(after.content).toBe('dos');
      expect(after.contentVersion).toBe(2);
    });

    it('vaciar el documento es un guardado legítimo y deja contentBytes en 0', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Vaciable'), directoryId: null, content: 'algo escrito' },
      );

      const saved = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: '',
        expectedVersion: 0,
      });

      expect(saved?.contentBytes).toBe(0);
      expect(saved?.contentVersion).toBe(1);

      const after = await documentRowOf(ownerId, created.id);

      expect(after.content).toBe('');
      expect(after.contentBytes).toBe(0);
    });

    it('con una versión rancia no devuelve nada y la fila no cambia en absoluto, updatedAt incluido', async () => {
      const directory = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Cuaderno'), parentId: null },
      );
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Disputado'), directoryId: directory.id, content: 'inicial' },
      );

      await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'el que ganó',
        expectedVersion: 0,
      });

      const before = await documentRowOf(ownerId, created.id);

      expect(before.contentVersion).toBe(1);

      await tick();

      const perdedor = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'el que llegó tarde',
        expectedVersion: 0,
      });

      expect(perdedor).toBeNull();
      // Toda la fila, columna a columna: content, contentBytes, contentVersion, title, titleKey,
      // directoryId, parentScopeId y `updatedAt`.
      expect(await documentRowOf(ownerId, created.id)).toEqual(before);
    });

    it('con una versión por delante de la vigente tampoco escribe', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Adelantado'), directoryId: null, content: 'inicial' },
      );
      const before = await documentRowOf(ownerId, created.id);

      await tick();

      await expect(
        ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
          content: 'del futuro',
          expectedVersion: 7,
        }),
      ).resolves.toBeNull();

      expect(await documentRowOf(ownerId, created.id)).toEqual(before);
    });

    it('con el scope de otro usuario no escribe aunque la versión sea la correcta', async () => {
      const directory = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Privado'), parentId: null },
      );
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Secreto'), directoryId: directory.id, content: 'confidencial' },
      );
      const before = await documentRowOf(ownerId, created.id);

      expect(before.contentVersion).toBe(0);

      await tick();

      await expect(
        ctx.repository.saveDocumentContent({ userId: intruderId }, created.id, {
          content: 'robado',
          expectedVersion: 0,
        }),
      ).resolves.toBeNull();

      expect(await documentRowOf(ownerId, created.id)).toEqual(before);
    });

    it('con el scope de otro usuario y además una versión rancia tampoco escribe', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Secreto'), directoryId: null, content: 'confidencial' },
      );

      await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'v1 del dueño',
        expectedVersion: 0,
      });

      const before = await documentRowOf(ownerId, created.id);

      await tick();

      await expect(
        ctx.repository.saveDocumentContent({ userId: intruderId }, created.id, {
          content: 'robado',
          expectedVersion: 0,
        }),
      ).resolves.toBeNull();

      expect(await documentRowOf(ownerId, created.id)).toEqual(before);
    });

    it('renombrar mueve updatedAt pero NO contentVersion, y el guardado pendiente sigue entrando', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Acta'), directoryId: null, content: 'texto' },
      );

      const saved = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'lo que el editor ya guardó',
        expectedVersion: 0,
      });
      const versionEnElEditor = saved?.contentVersion ?? -1;

      expect(versionEnElEditor).toBe(1);

      const antesDelRenombrado = await documentRowOf(ownerId, created.id);

      await tick();
      await ctx.repository.updateDocument(
        { userId: ownerId },
        created.id,
        titleOf('Acta revisada'),
      );

      const trasElRenombrado = await documentRowOf(ownerId, created.id);

      expect(trasElRenombrado.title).toBe('Acta revisada');
      expect(trasElRenombrado.contentVersion).toBe(1);
      expect(trasElRenombrado.content).toBe('lo que el editor ya guardó');
      // Esta es la línea que justifica la columna dedicada: renombrar SÍ mueve `updatedAt`, así que
      // con `updatedAt` de token el guardado de abajo daría un conflicto inexistente.
      expect(trasElRenombrado.updatedAt.getTime()).toBeGreaterThan(
        antesDelRenombrado.updatedAt.getTime(),
      );

      const trasElGuardado = await ctx.repository.saveDocumentContent(
        { userId: ownerId },
        created.id,
        { content: 'lo que se escribió mientras', expectedVersion: versionEnElEditor },
      );

      expect(trasElGuardado?.contentVersion).toBe(2);

      const final = await documentRowOf(ownerId, created.id);

      expect(final.content).toBe('lo que se escribió mientras');
      expect(final.title).toBe('Acta revisada');
    });

    it('mover no cambia contentVersion ni content, y el guardado pendiente sigue entrando', async () => {
      const origen = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Origen'), parentId: null },
      );
      const destino = await ctx.repository.createDirectory(
        { userId: ownerId },
        { ...nameOf('Destino'), parentId: null },
      );
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Acta'), directoryId: origen.id, content: 'texto' },
      );

      const saved = await ctx.repository.saveDocumentContent({ userId: ownerId }, created.id, {
        content: 'guardado antes de mover',
        expectedVersion: 0,
      });
      const versionEnElEditor = saved?.contentVersion ?? -1;

      await tick();
      await ctx.repository.moveDocument({ userId: ownerId }, created.id, destino.id);

      const trasElMove = await documentRowOf(ownerId, created.id);

      expect(trasElMove.directoryId).toBe(destino.id);
      expect(trasElMove.parentScopeId).toBe(destino.id);
      expect(trasElMove.contentVersion).toBe(1);
      expect(trasElMove.content).toBe('guardado antes de mover');

      const trasElGuardado = await ctx.repository.saveDocumentContent(
        { userId: ownerId },
        created.id,
        { content: 'guardado después de mover', expectedVersion: versionEnElEditor },
      );

      expect(trasElGuardado?.contentVersion).toBe(2);

      const final = await documentRowOf(ownerId, created.id);

      expect(final.content).toBe('guardado después de mover');
      expect(final.directoryId).toBe(destino.id);
      expect(final.parentScopeId).toBe(destino.id);
    });

    it('createDocument sigue calculando contentBytes en bytes UTF-8 tras pasar por contentBytesOf', async () => {
      const created = await ctx.repository.createDocument(
        { userId: ownerId },
        { ...titleOf('Emoji'), directoryId: null, content: '🙂' },
      );

      // Un par suplente: 2 unidades UTF-16, 1 punto de código, 4 bytes.
      expect(created.contentBytes).toBe(4);
      expect((await documentRowOf(ownerId, created.id)).contentBytes).toBe(4);
    });
  });
});
