import {
  ancestorsOf,
  assertMovable,
  depthOf,
  subtreeHeightOf,
  type TreeNodeRef,
} from './tree-graph';
import {
  DepthLimitExceededError,
  MoveIntoDescendantError,
  WorkspaceDomainError,
  WorkspaceTreeIntegrityError,
} from './workspace.errors';

/**
 * Dominio puro: ni Nest, ni Prisma, ni HTTP. El grafo se prueba sobre un `Map` construido a mano,
 * y `maxDepth` es un parámetro de `assertMovable`, así que estos casos usan topes pequeños (`3`,
 * `4`) en vez de cadenas de diez niveles.
 */

const indexOf = (nodes: readonly TreeNodeRef[]): Map<string, TreeNodeRef> =>
  new Map(nodes.map((node) => [node.id, node]));

/**
 * Dos ramas independientes de tres niveles:
 *
 *   a ── b ── c        `a` es el sujeto de los moves: altura 2
 *   d ── e ── f        destinos a profundidad 0, 1 y 2
 */
const tree = indexOf([
  { id: 'a', parentId: null },
  { id: 'b', parentId: 'a' },
  { id: 'c', parentId: 'b' },
  { id: 'd', parentId: null },
  { id: 'e', parentId: 'd' },
  { id: 'f', parentId: 'e' },
]);

function assertDomainError(error: unknown): asserts error is WorkspaceDomainError {
  if (!(error instanceof WorkspaceDomainError)) {
    throw new Error(`Se esperaba un WorkspaceDomainError y llegó: ${String(error)}`);
  }
}

/** Comprueba que `run` lanza un error de dominio con exactamente ese `code`. */
const expectDomainCode = (run: () => void, code: string): void => {
  let thrown: unknown;
  let didThrow = false;

  try {
    run();
  } catch (error: unknown) {
    didThrow = true;
    thrown = error;
  }

  expect(didThrow).toBe(true);
  assertDomainError(thrown);
  expect(thrown.code).toBe(code);
};

describe('tree-graph', () => {
  describe('ancestorsOf', () => {
    it('devuelve una lista vacía en la raíz', () => {
      expect(ancestorsOf('a', tree)).toEqual([]);
    });

    it('devuelve la cadena completa de un nieto, del padre a la raíz', () => {
      expect(ancestorsOf('c', tree)).toEqual(['b', 'a']);
    });

    it('devuelve un solo ancestro para un hijo directo', () => {
      expect(ancestorsOf('b', tree)).toEqual(['a']);
    });

    // Estos dos casos son la razón de ser de la guarda: sin ella el bucle no termina nunca y el
    // proceso de test se cuelga en vez de fallar.
    it('lanza (y termina) cuando el mapa tiene un ciclo de dos nodos', () => {
      const cyclic = indexOf([
        { id: 'x', parentId: 'y' },
        { id: 'y', parentId: 'x' },
      ]);

      expect(() => ancestorsOf('x', cyclic)).toThrow(WorkspaceTreeIntegrityError);
    });

    it('lanza (y termina) cuando un nodo es su propio padre', () => {
      const selfLoop = indexOf([{ id: 's', parentId: 's' }]);

      expect(() => ancestorsOf('s', selfLoop)).toThrow(WorkspaceTreeIntegrityError);
    });

    it('lanza si el nodo no está en el mapa', () => {
      expect(() => ancestorsOf('ausente', tree)).toThrow(WorkspaceTreeIntegrityError);
    });

    it('lanza si el padre de un nodo no está en el mapa', () => {
      const dangling = indexOf([{ id: 'huerfano', parentId: 'nadie' }]);

      expect(() => ancestorsOf('huerfano', dangling)).toThrow(WorkspaceTreeIntegrityError);
    });
  });

  describe('depthOf', () => {
    it('cuenta los ancestros: la raíz mide 0', () => {
      expect(depthOf('a', tree)).toBe(0);
      expect(depthOf('b', tree)).toBe(1);
      expect(depthOf('c', tree)).toBe(2);
    });
  });

  describe('subtreeHeightOf', () => {
    it('devuelve 0 en una hoja', () => {
      expect(subtreeHeightOf('c', tree)).toBe(0);
    });

    it('devuelve 2 en un abuelo', () => {
      expect(subtreeHeightOf('a', tree)).toBe(2);
    });

    it('devuelve 1 en un padre de hoja', () => {
      expect(subtreeHeightOf('b', tree)).toBe(1);
    });

    it('lanza (y termina) cuando hay un ciclo por debajo del nodo', () => {
      const cyclic = indexOf([
        { id: 'r', parentId: null },
        { id: 'x', parentId: 'r' },
        { id: 'y', parentId: 'x' },
        { id: 'z', parentId: 'y' },
      ]);
      // `x` pasa a colgar de su propio nieto: el descenso vuelve a visitar `x`.
      cyclic.set('x', { id: 'x', parentId: 'z' });

      expect(() => subtreeHeightOf('x', cyclic)).toThrow(WorkspaceTreeIntegrityError);
    });
  });

  describe('assertMovable', () => {
    it('rechaza mover un directorio dentro de sí mismo', () => {
      expectDomainCode(
        () => assertMovable({ subjectId: 'a', targetId: 'a', byId: tree, maxDepth: 4 }),
        'MOVE_INTO_DESCENDANT',
      );
    });

    it('rechaza mover un directorio dentro de un descendiente suyo', () => {
      expectDomainCode(
        () => assertMovable({ subjectId: 'a', targetId: 'c', byId: tree, maxDepth: 4 }),
        'MOVE_INTO_DESCENDANT',
      );
    });

    it('el rechazo por descendiente es un MoveIntoDescendantError', () => {
      expect(() =>
        assertMovable({ subjectId: 'a', targetId: 'b', byId: tree, maxDepth: 4 }),
      ).toThrow(MoveIntoDescendantError);
    });

    it('el ciclo se comprueba antes que la profundidad', () => {
      // El destino es el propio sujeto y además rompería el tope: gana `MOVE_INTO_DESCENDANT`.
      expectDomainCode(
        () => assertMovable({ subjectId: 'a', targetId: 'a', byId: tree, maxDepth: 1 }),
        'MOVE_INTO_DESCENDANT',
      );
    });

    it('rechaza un subárbol de altura 2 movido a un destino demasiado profundo', () => {
      // `f` está a profundidad 2; `a` quedaría a 3 y su nieto a 5, por encima del tope 4.
      expectDomainCode(
        () => assertMovable({ subjectId: 'a', targetId: 'f', byId: tree, maxDepth: 4 }),
        'DEPTH_LIMIT_EXCEEDED',
      );
    });

    it('el rechazo por profundidad es un DepthLimitExceededError', () => {
      expect(() =>
        assertMovable({ subjectId: 'a', targetId: 'f', byId: tree, maxDepth: 4 }),
      ).toThrow(DepthLimitExceededError);
    });

    it('rechaza el mismo subárbol contra un tope más estrecho, aunque el destino esté en la raíz', () => {
      // Con `maxDepth: 3` las profundidades válidas son 0…2: `a` en `d` dejaría su nieto a 3.
      expectDomainCode(
        () => assertMovable({ subjectId: 'a', targetId: 'd', byId: tree, maxDepth: 3 }),
        'DEPTH_LIMIT_EXCEEDED',
      );
    });

    it('acepta el mismo movimiento a un destino con hueco', () => {
      // `d` está a profundidad 0: `a` quedaría a 1 y su nieto a 3, justo dentro del tope 4.
      expect(() =>
        assertMovable({ subjectId: 'a', targetId: 'd', byId: tree, maxDepth: 4 }),
      ).not.toThrow();
    });

    it('acepta mover a la raíz (targetId null)', () => {
      expect(() =>
        assertMovable({ subjectId: 'a', targetId: null, byId: tree, maxDepth: 3 }),
      ).not.toThrow();
    });

    it('acepta mover al padre que ya se tiene: es un no-op, no un error', () => {
      expect(() =>
        assertMovable({ subjectId: 'b', targetId: 'a', byId: tree, maxDepth: 4 }),
      ).not.toThrow();
    });

    it('acepta dejar en la raíz un directorio que ya está en la raíz', () => {
      expect(() =>
        assertMovable({ subjectId: 'd', targetId: null, byId: tree, maxDepth: 4 }),
      ).not.toThrow();
    });

    it('lanza un error de integridad si el sujeto no está en el mapa', () => {
      expect(() =>
        assertMovable({ subjectId: 'ausente', targetId: 'd', byId: tree, maxDepth: 4 }),
      ).toThrow(WorkspaceTreeIntegrityError);
    });

    it('lanza un error de integridad si el destino no está en el mapa', () => {
      expect(() =>
        assertMovable({ subjectId: 'a', targetId: 'ausente', byId: tree, maxDepth: 4 }),
      ).toThrow(WorkspaceTreeIntegrityError);
    });
  });

  describe('errores de dominio', () => {
    it('los dos comparten la clase base y llevan su propio code', () => {
      const intoDescendant = new MoveIntoDescendantError();
      const depthExceeded = new DepthLimitExceededError();

      expect(intoDescendant).toBeInstanceOf(WorkspaceDomainError);
      expect(depthExceeded).toBeInstanceOf(WorkspaceDomainError);
      expect(intoDescendant.code).toBe('MOVE_INTO_DESCENDANT');
      expect(depthExceeded.code).toBe('DEPTH_LIMIT_EXCEEDED');
    });

    it('el error de integridad del árbol no es un error de dominio: no lleva code', () => {
      // Un ciclo es corrupción, no una regla de negocio: no puede salir como un 409 con `code`.
      const integrity = new WorkspaceTreeIntegrityError('CYCLE', 'ciclo detectado');

      expect(integrity).toBeInstanceOf(Error);
      expect(integrity).not.toBeInstanceOf(WorkspaceDomainError);
      expect(integrity.reason).toBe('CYCLE');
    });
  });
});
