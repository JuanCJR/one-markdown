import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DirectoriesService } from './directories.service';
import type { CreateDirectoryRequestDto } from './dto/create-directory.request.dto';
import { MAX_WORKSPACE_NODES } from './workspace.constants';
import {
  WorkspaceRepository,
  type CreateDirectoryData,
  type DirectoryRow,
  type WorkspaceScope,
} from './workspace.repository';

/**
 * Tope de nodos por usuario en el alta de **directorios** (spec 002, AC-21).
 *
 * Unitario y no e2e porque el caso interesante es «el usuario ya tiene 5.000 nodos», y montarlo de
 * verdad costaría 5.000 escrituras: aquí el contador es un doble que lo afirma en una línea. El
 * doble es del **repositorio**, es decir del borde de la clase, no de la decisión bajo prueba: lo
 * que se comprueba es que el servicio consulta el contador **antes** de escribir y que corta con el
 * `code` del contrato, no que un mock devuelva lo que se le dijo.
 *
 * El límite afecta al alta de los dos tipos de nodo y cada servicio tiene su archivo: el hermano de
 * éste es `documents.service.spec.ts`.
 */

const SCOPE: WorkspaceScope = { userId: '11111111-1111-4111-8111-111111111111' };

const DTO: CreateDirectoryRequestDto = { name: 'Notas', parentId: null };

const FIXED_DATE = new Date('2026-07-25T00:00:00.000Z');

/**
 * Monta el servicio con un repositorio doblado.
 *
 * El doble se pasa por `useValue`, que no exige el tipo de la clase: así no hace falta ningún
 * `as unknown as` para saltarse el campo privado `prisma` de `WorkspaceRepository`.
 *
 * Solo dobla los dos métodos que recorre el alta en la raíz (`parentId: null` no consulta el árbol
 * de directorios): si el servicio llamara a cualquier otro, el doble fallaría en vez de callar.
 */
async function createSubject(nodeCount: number) {
  const countWorkspaceNodes = jest.fn(
    (_scope: WorkspaceScope): Promise<number> => Promise.resolve(nodeCount),
  );

  const createDirectory = jest.fn(
    (_scope: WorkspaceScope, data: CreateDirectoryData): Promise<DirectoryRow> =>
      Promise.resolve({
        id: '22222222-2222-4222-8222-222222222222',
        parentId: data.parentId,
        name: data.name,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      }),
  );

  const moduleRef = await Test.createTestingModule({
    providers: [
      DirectoriesService,
      { provide: WorkspaceRepository, useValue: { countWorkspaceNodes, createDirectory } },
    ],
  }).compile();

  return { service: moduleRef.get(DirectoriesService), countWorkspaceNodes, createDirectory };
}

/** Devuelve lo que lanzó `run`, o `undefined` si no lanzó (que el caso afirma como fallo). */
async function captureError(run: () => Promise<unknown>): Promise<unknown> {
  try {
    await run();
  } catch (error) {
    return error;
  }

  return undefined;
}

describe('DirectoriesService — tope de nodos por usuario (AC-21)', () => {
  it('rechaza el alta con 409 WORKSPACE_LIMIT_REACHED cuando el usuario está en el tope', async () => {
    const { service, createDirectory } = await createSubject(MAX_WORKSPACE_NODES);

    const error = await captureError(() => service.createDirectory(SCOPE, DTO));

    expect(error).toBeInstanceOf(ConflictException);

    if (!(error instanceof ConflictException)) {
      throw new Error('createDirectory tenía que lanzar una ConflictException');
    }

    expect(error.getStatus()).toBe(409);
    // El `code` es lo que la interfaz empareja: el texto del mensaje puede cambiar, el código no.
    expect(error.getResponse()).toEqual({
      message: expect.any(String),
      code: 'WORKSPACE_LIMIT_REACHED',
    });

    // Y **no se escribe nada**: cortar después de crear la fila dejaría el `409` mintiendo.
    expect(createDirectory).not.toHaveBeenCalled();
  });

  it('cuenta los nodos del usuario del token, no los de toda la instalación', async () => {
    const { service, countWorkspaceNodes } = await createSubject(MAX_WORKSPACE_NODES);

    await captureError(() => service.createDirectory(SCOPE, DTO));

    expect(countWorkspaceNodes).toHaveBeenCalledTimes(1);
    expect(countWorkspaceNodes).toHaveBeenCalledWith(SCOPE);
  });

  it('con un nodo por debajo del tope crea el directorio', async () => {
    const { service, createDirectory } = await createSubject(MAX_WORKSPACE_NODES - 1);

    const created = await service.createDirectory(SCOPE, DTO);

    expect(created.name).toBe('Notas');
    expect(created.parentId).toBeNull();
    expect(createDirectory).toHaveBeenCalledTimes(1);
  });
});
