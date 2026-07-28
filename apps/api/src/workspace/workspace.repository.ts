import { Injectable } from '@nestjs/common';

import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Único punto del módulo `workspace` que conoce Prisma (decisión 14 del plan de la spec 002, y
 * `workspace-data-access.spec.ts` lo comprueba sobre el árbol de archivos).
 *
 * Dos reglas que no son de estilo, son la autorización de la aplicación:
 *
 * 1. **`scope` es el primer parámetro de todos los métodos.** No hay ninguna firma en la que el
 *    usuario se pueda olvidar: para llamar hay que decir de quién es la operación.
 * 2. **`userId` va en todos los `where`.** Por eso «no existe» y «no es tuyo» son literalmente la
 *    misma rama de código y salen los dos como `404` (decisión 9), sin un `if` de propiedad que
 *    alguien pueda olvidar en el endpoint número once.
 *
 * Lo que este archivo **no** hace: traducir errores (eso es `prisma-error.ts`), normalizar nombres
 * (eso es `workspace-name.ts`) ni comprobar reglas del árbol (eso es `tree-graph.ts`). Recibe las
 * claves ya calculadas y escribe.
 */

/** De quién es la operación. Sale siempre del token, nunca de un parámetro del cliente. */
export interface WorkspaceScope {
  readonly userId: string;
}

/**
 * Ámbito de unicidad de un nodo: `parentId ?? userId`.
 *
 * Existe porque PostgreSQL considera los `NULL` **distintos** entre sí, así que un
 * `@@unique([userId, parentId, nameKey])` no impediría dos carpetas homónimas en la raíz, que es
 * justo donde más se crean. Con esta columna no nula, el índice `[parentScopeId, nameKey]` cubre la
 * raíz igual que cualquier otro nivel.
 *
 * Es el **único** sitio donde se decide ese valor: si cada método lo calculara por su cuenta, la
 * primera copia que se despistara metería una fila en el cubo de unicidad equivocado.
 * En documentos el «padre» es el `directoryId`.
 */
export function parentScopeIdFor({
  userId,
  parentId,
}: {
  readonly userId: string;
  readonly parentId: string | null;
}): string {
  return parentId ?? userId;
}

/**
 * Columnas de un directorio que salen del repositorio.
 *
 * `userId`, `nameKey` y `parentScopeId` **no** están, y no es un descuido: son columnas internas
 * (propiedad y claves de unicidad) que ningún DTO puede exponer (AC-26). Al no seleccionarlas, la
 * fuga no depende de que el servicio se acuerde de omitirlas: no hay nada que omitir. Lo que sí
 * necesita el listado —ordenar por `nameKey`— lo hace el `orderBy` de la propia consulta.
 */
const DIRECTORY_SELECT = {
  id: true,
  parentId: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;

/** Resumen de documento **sin** `content`: en PostgreSQL ese texto vive en TOAST y traerlo cuesta. */
const DOCUMENT_SUMMARY_SELECT = {
  id: true,
  directoryId: true,
  title: true,
  contentBytes: true,
  createdAt: true,
  updatedAt: true,
} as const;

const DOCUMENT_SELECT = { ...DOCUMENT_SUMMARY_SELECT, content: true } as const;

export interface DirectoryRow {
  readonly id: string;
  readonly parentId: string | null;
  readonly name: string;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Lo mínimo que necesita el grafo del árbol: id y padre. Es lo que se carga para calcular
 * profundidades y alturas sin traerse nombres ni fechas de miles de filas.
 */
export interface DirectoryRefRow {
  readonly id: string;
  readonly parentId: string | null;
}

export interface DocumentSummaryRow {
  readonly id: string;
  readonly directoryId: string | null;
  readonly title: string;
  readonly contentBytes: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

export interface DocumentRow extends DocumentSummaryRow {
  readonly content: string;
}

export interface CreateDirectoryData {
  /** Nombre visible, ya normalizado. */
  readonly name: string;
  /** Clave de unicidad, ya calculada por `workspaceNameKey`. */
  readonly nameKey: string;
  /** `null` = raíz del workspace. La propiedad del padre la verifica el servicio antes de llamar. */
  readonly parentId: string | null;
}

export interface UpdateDirectoryData {
  readonly name: string;
  readonly nameKey: string;
}

/**
 * Vista del árbol del usuario **dentro de una transacción**, con las tres operaciones que necesita
 * un move: leer la foto del árbol, leer un directorio y reasignarle el padre.
 *
 * Existe para que la decisión —ciclo, profundidad, no-op— viva en el servicio y la transacción viva
 * en el repositorio, sin que el servicio llegue a ver el cliente de Prisma (decisión 14 del plan,
 * comprobada sobre el árbol de archivos por `workspace-data-access.spec.ts`). Las tres funciones
 * llevan el `userId` del `scope` cerrado dentro: no hay firma en la que se pueda pasar otro.
 */
export interface WorkspaceTreeTransaction {
  /** Todos los directorios del usuario reducidos a `{ id, parentId }`, leídos dentro de la tx. */
  readonly listDirectoryRefs: () => Promise<DirectoryRefRow[]>;
  /** El directorio, o `null` si no existe **o no es del usuario**. */
  readonly findDirectory: (id: string) => Promise<DirectoryRow | null>;
  /** Reasigna el padre y recalcula `parentScopeId`. Lanza `P2025` si no es del usuario. */
  readonly moveDirectory: (id: string, parentId: string | null) => Promise<DirectoryRow>;
}

export interface CreateDocumentData {
  readonly title: string;
  readonly titleKey: string;
  readonly directoryId: string | null;
  readonly content: string;
}

export interface UpdateDocumentData {
  readonly title: string;
  readonly titleKey: string;
}

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  // ------------------------------------------------------------------------------------------
  // Directorios
  // ------------------------------------------------------------------------------------------

  async createDirectory(
    scope: WorkspaceScope,
    data: CreateDirectoryData,
  ): Promise<DirectoryRow> {
    return this.prisma.directory.create({
      data: {
        userId: scope.userId,
        parentId: data.parentId,
        parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId: data.parentId }),
        name: data.name,
        nameKey: data.nameKey,
      },
      select: DIRECTORY_SELECT,
    });
  }

  async findDirectory(scope: WorkspaceScope, id: string): Promise<DirectoryRow | null> {
    return this.prisma.directory.findFirst({
      where: { id, userId: scope.userId },
      select: DIRECTORY_SELECT,
    });
  }

  /**
   * Todos los directorios del usuario reducidos a `{ id, parentId }`.
   *
   * Es la foto que consume `tree-graph` para calcular profundidad, altura y ciclos. Va acotada por
   * el tope de nodos por usuario, y el `select` deja fuera nombres y fechas: de un árbol de miles
   * de filas solo viajan dos uuid por nodo.
   */
  async listDirectoryRefs(scope: WorkspaceScope): Promise<DirectoryRefRow[]> {
    return this.prisma.directory.findMany({
      where: { userId: scope.userId },
      select: { id: true, parentId: true },
    });
  }

  /**
   * Todos los directorios del usuario, completos, para servir el árbol.
   *
   * **El orden lo pone el `orderBy`, no el servicio.** Sin él PostgreSQL puede devolver las filas en
   * cualquier orden —normalmente el físico, que cambia con cada actualización—, así que dos
   * recargas seguidas reordenarían la barra lateral sin que nada hubiera cambiado. Ordenar después
   * en memoria costaría lo mismo y perdería el desempate estable.
   *
   * Se ordena por `nameKey` y **no** por `name`: la clave es el nombre normalizado en minúsculas, de
   * modo que `alfa` y `Alfa` caen juntos en vez de separarse por la caja, que es como ordena la
   * comparación byte a byte. `id` desempata para que dos hermanos homónimos —posibles en carpetas
   * distintas— tengan siempre el mismo orden relativo.
   *
   * `nameKey` se puede usar en el `orderBy` sin sacarlo del `select`: la ordenación la hace la base,
   * y la columna sigue sin viajar al cliente (AC-26).
   */
  async listDirectories(scope: WorkspaceScope): Promise<DirectoryRow[]> {
    return this.prisma.directory.findMany({
      where: { userId: scope.userId },
      select: DIRECTORY_SELECT,
      orderBy: [{ nameKey: 'asc' }, { id: 'asc' }],
    });
  }

  /**
   * Hijos directos de un directorio: subdirectorios **más** documentos.
   *
   * Basta con los hijos directos: si no hay ninguno, tampoco hay nietos, así que contar el subárbol
   * entero sería recorrer filas para llegar a la misma decisión. Las dos consultas llevan `userId`,
   * de modo que un directorio ajeno cuenta `0` hijos y acaba saliendo como `404` por el `delete`,
   * nunca como un `409` que confirmaría que el id existe.
   */
  async countDirectoryChildren(scope: WorkspaceScope, id: string): Promise<number> {
    const [directories, documents] = await Promise.all([
      this.prisma.directory.count({ where: { userId: scope.userId, parentId: id } }),
      this.prisma.document.count({ where: { userId: scope.userId, directoryId: id } }),
    ]);

    return directories + documents;
  }

  /**
   * Nodos del usuario: directorios **más** documentos. Es lo que acota `MAX_WORKSPACE_NODES`
   * (AC-21), y por eso cuenta los dos tipos en una sola cifra: el tope es del workspace entero, no
   * de cada tabla por separado.
   *
   * Vive aquí y no en cada servicio para que la cuenta no dependa de qué alta se esté ejecutando:
   * crear el documento 5.001 tiene que fallar igual que crear el directorio 5.001.
   *
   * Los dos `where` llevan `userId`, así que un usuario nunca consume —ni ve— el cupo de otro. Es
   * un `count` con índice sobre `userId`, no un `findMany().length`: no trae ni una fila.
   */
  async countWorkspaceNodes(scope: WorkspaceScope): Promise<number> {
    const [directories, documents] = await Promise.all([
      this.prisma.directory.count({ where: { userId: scope.userId } }),
      this.prisma.document.count({ where: { userId: scope.userId } }),
    ]);

    return directories + documents;
  }

  /** Lanza `P2025` si el directorio no existe **o no es del usuario del `scope`**. */
  async updateDirectory(
    scope: WorkspaceScope,
    id: string,
    data: UpdateDirectoryData,
  ): Promise<DirectoryRow> {
    return this.prisma.directory.update({
      where: { id, userId: scope.userId },
      data: { name: data.name, nameKey: data.nameKey },
      select: DIRECTORY_SELECT,
    });
  }

  /**
   * Filas borradas: `0` si no existe o no es suyo, `1` si se borró. La cascada de PostgreSQL se
   * lleva el subárbol y los documentos; el servicio es quien decide si eso está permitido.
   *
   * Devuelve el número en vez de lanzar `P2025` porque el servicio necesita distinguir «no existe»
   * (→ `404`) de «existe pero tiene hijos» (→ `409`) sin capturar una excepción para eso.
   */
  async deleteDirectory(scope: WorkspaceScope, id: string): Promise<number> {
    const { count } = await this.prisma.directory.deleteMany({
      where: { id, userId: scope.userId },
    });

    return count;
  }

  /**
   * Corre `run` en una transacción interactiva con aislamiento `Serializable`.
   *
   * Es la **única** operación del workspace que lo necesita (decisión 7 del plan): el move decide
   * en función de una foto del árbol completo, y dos moves simultáneos en ramas distintas podrían
   * crear un ciclo que ninguno de los dos ve por separado —cada uno lee un árbol acíclico y escribe
   * la mitad del ciclo—. Con `Serializable`, PostgreSQL aborta uno de los dos y Prisma lo emite
   * como `P2034`, que `prisma-error.ts` traduce a `409 WORKSPACE_CONFLICT`: un conflicto que el
   * cliente puede reintentar, en vez de una corrupción silenciosa del árbol.
   *
   * El reintento **no** se hace aquí: es una decisión de producto (cuántas veces, con qué espera)
   * y en una operación que el usuario acaba de pedir a mano, decírselo es mejor que insistir.
   */
  async inSerializableTransaction<T>(
    scope: WorkspaceScope,
    run: (tx: WorkspaceTreeTransaction) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(
      async (tx) =>
        run({
          listDirectoryRefs: () =>
            tx.directory.findMany({
              where: { userId: scope.userId },
              select: { id: true, parentId: true },
            }),
          findDirectory: (id) =>
            tx.directory.findFirst({
              where: { id, userId: scope.userId },
              select: DIRECTORY_SELECT,
            }),
          moveDirectory: (id, parentId) =>
            tx.directory.update({
              where: { id, userId: scope.userId },
              data: {
                parentId,
                // Recalcularlo aquí no es opcional: sin esto la fila movida se quedaría en el
                // cubo de unicidad de su padre anterior y podrían convivir dos hermanos con el
                // mismo nombre en el destino.
                parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId }),
              },
              select: DIRECTORY_SELECT,
            }),
        }),
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  }

  // ------------------------------------------------------------------------------------------
  // Documentos
  // ------------------------------------------------------------------------------------------

  async createDocument(scope: WorkspaceScope, data: CreateDocumentData): Promise<DocumentRow> {
    return this.prisma.document.create({
      data: {
        userId: scope.userId,
        directoryId: data.directoryId,
        parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId: data.directoryId }),
        title: data.title,
        titleKey: data.titleKey,
        content: data.content,
        // Se persiste al escribir para que el listado del árbol nunca tenga que leer `content`.
        // En bytes UTF-8 y no en caracteres: es el tamaño real de lo guardado.
        contentBytes: Buffer.byteLength(data.content, 'utf8'),
      },
      select: DOCUMENT_SELECT,
    });
  }

  /**
   * Todos los documentos del usuario **sin su texto**, para servir el árbol.
   *
   * El `select` es `DOCUMENT_SUMMARY_SELECT`, que deja fuera `content` a propósito: en PostgreSQL un
   * texto largo vive en TOAST y traerlo obligaría a leerlo de fuera de la tabla, fila por fila. Un
   * listado con contenidos sería, en la práctica, descargar el workspace entero cada vez que la
   * barra lateral se refresca. El tamaño que sí interesa ya está en `contentBytes`, que es columna
   * persistida justo para esto.
   *
   * Mismo criterio de orden que en `listDirectories`, con `titleKey`: la base ordena por la clave
   * normalizada y desempata por `id`, y la columna sigue sin salir en el `select` (AC-26).
   */
  async listDocumentSummaries(scope: WorkspaceScope): Promise<DocumentSummaryRow[]> {
    return this.prisma.document.findMany({
      where: { userId: scope.userId },
      select: DOCUMENT_SUMMARY_SELECT,
      orderBy: [{ titleKey: 'asc' }, { id: 'asc' }],
    });
  }

  async findDocument(scope: WorkspaceScope, id: string): Promise<DocumentRow | null> {
    return this.prisma.document.findFirst({
      where: { id, userId: scope.userId },
      select: DOCUMENT_SELECT,
    });
  }

  /** Lanza `P2025` si el documento no existe **o no es del usuario del `scope`**. */
  async updateDocument(
    scope: WorkspaceScope,
    id: string,
    data: UpdateDocumentData,
  ): Promise<DocumentSummaryRow> {
    return this.prisma.document.update({
      where: { id, userId: scope.userId },
      data: { title: data.title, titleKey: data.titleKey },
      select: DOCUMENT_SUMMARY_SELECT,
    });
  }

  /**
   * Reasigna el directorio contenedor de un documento y **recalcula `parentScopeId`**. Lanza
   * `P2025` si no existe o no es del usuario, `P2002` si en el destino ya hay un documento con ese
   * `titleKey` y `P2003` si el directorio de destino desapareció entre la comprobación y aquí.
   *
   * Recalcular el ámbito no es opcional ni cosmético: sin ello la fila movida se quedaría en el
   * cubo de unicidad de su directorio anterior, de modo que en el destino podrían convivir dos
   * documentos con el mismo título y en el origen ninguno podría reutilizar el suyo. El índice
   * único no se enteraría, porque compara `[parentScopeId, titleKey]`, no `[directoryId, titleKey]`.
   *
   * **No** hay transacción `Serializable`, a diferencia del move de directorios: un documento es
   * siempre una hoja, así que no hay ciclo ni profundidad que comprobar sobre una foto del árbol.
   */
  async moveDocument(
    scope: WorkspaceScope,
    id: string,
    directoryId: string | null,
  ): Promise<DocumentSummaryRow> {
    return this.prisma.document.update({
      where: { id, userId: scope.userId },
      data: {
        directoryId,
        parentScopeId: parentScopeIdFor({ userId: scope.userId, parentId: directoryId }),
      },
      select: DOCUMENT_SUMMARY_SELECT,
    });
  }

  /** Filas borradas: `0` si no existe o no es suyo, `1` si se borró. */
  async deleteDocument(scope: WorkspaceScope, id: string): Promise<number> {
    const { count } = await this.prisma.document.deleteMany({
      where: { id, userId: scope.userId },
    });

    return count;
  }
}
