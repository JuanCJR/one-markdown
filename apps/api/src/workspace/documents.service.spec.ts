import { ConflictException } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { DocumentsService } from './documents.service';
import type { CreateDocumentRequestDto } from './dto/create-document.request.dto';
import { MAX_WORKSPACE_NODES } from './workspace.constants';
import {
  WorkspaceRepository,
  type CreateDocumentData,
  type DocumentRow,
  type WorkspaceScope,
} from './workspace.repository';

/**
 * Tope de nodos por usuario en el alta de **documentos** (spec 002, AC-21).
 *
 * Hermano de `directories.service.spec.ts`: el tope cuenta directorios **más** documentos, así que
 * los dos caminos de alta tienen que consultarlo. Un tope que solo frenara los directorios dejaría
 * la puerta abierta a los 5.001 documentos, que es exactamente lo que el AC prohíbe.
 */

const SCOPE: WorkspaceScope = { userId: '11111111-1111-4111-8111-111111111111' };

const DTO: CreateDocumentRequestDto = { title: 'Ideas', directoryId: null, content: '# Hola' };

const FIXED_DATE = new Date('2026-07-25T00:00:00.000Z');

/**
 * Monta el servicio con un repositorio doblado.
 *
 * El doble se pasa por `useValue`, que no exige el tipo de la clase: así no hace falta ningún
 * `as unknown as` para saltarse el campo privado `prisma` de `WorkspaceRepository`.
 *
 * Solo dobla los dos métodos que recorre el alta en la raíz (`directoryId: null` no consulta
 * ningún directorio): si el servicio llamara a cualquier otro, el doble fallaría en vez de callar.
 */
async function createSubject(nodeCount: number) {
  const countWorkspaceNodes = jest.fn(
    (_scope: WorkspaceScope): Promise<number> => Promise.resolve(nodeCount),
  );

  const createDocument = jest.fn(
    (_scope: WorkspaceScope, data: CreateDocumentData): Promise<DocumentRow> =>
      Promise.resolve({
        id: '33333333-3333-4333-8333-333333333333',
        directoryId: data.directoryId,
        title: data.title,
        content: data.content,
        contentBytes: Buffer.byteLength(data.content, 'utf8'),
        // Literal y no `contentBytesOf(...)` ni una constante de producción, por el mismo motivo por
        // el que `contentBytes` se calcula aquí a mano (spec 003, T-003): un doble que llama a lo
        // que llama el sujeto deja de ser un oráculo independiente y pasa a comprobar el mock. Un
        // documento recién creado arranca en `0` por el `@default(0)` del esquema, así que `0` es la
        // respuesta correcta escrita sin mirar la implementación.
        contentVersion: 0,
        createdAt: FIXED_DATE,
        updatedAt: FIXED_DATE,
      }),
  );

  const moduleRef = await Test.createTestingModule({
    providers: [
      DocumentsService,
      { provide: WorkspaceRepository, useValue: { countWorkspaceNodes, createDocument } },
    ],
  }).compile();

  return { service: moduleRef.get(DocumentsService), countWorkspaceNodes, createDocument };
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

describe('DocumentsService — tope de nodos por usuario (AC-21)', () => {
  it('rechaza el alta con 409 WORKSPACE_LIMIT_REACHED cuando el usuario está en el tope', async () => {
    const { service, createDocument } = await createSubject(MAX_WORKSPACE_NODES);

    const error = await captureError(() => service.createDocument(SCOPE, DTO));

    expect(error).toBeInstanceOf(ConflictException);

    if (!(error instanceof ConflictException)) {
      throw new Error('createDocument tenía que lanzar una ConflictException');
    }

    expect(error.getStatus()).toBe(409);
    // El `code` es lo que la interfaz empareja: el texto del mensaje puede cambiar, el código no.
    expect(error.getResponse()).toEqual({
      message: expect.any(String),
      code: 'WORKSPACE_LIMIT_REACHED',
    });

    // Y **no se escribe nada**: cortar después de crear la fila dejaría el `409` mintiendo.
    expect(createDocument).not.toHaveBeenCalled();
  });

  it('cuenta los nodos del usuario del token, no los de toda la instalación', async () => {
    const { service, countWorkspaceNodes } = await createSubject(MAX_WORKSPACE_NODES);

    await captureError(() => service.createDocument(SCOPE, DTO));

    expect(countWorkspaceNodes).toHaveBeenCalledTimes(1);
    expect(countWorkspaceNodes).toHaveBeenCalledWith(SCOPE);
  });

  it('con un nodo por debajo del tope crea el documento', async () => {
    const { service, createDocument } = await createSubject(MAX_WORKSPACE_NODES - 1);

    const created = await service.createDocument(SCOPE, DTO);

    expect(created.title).toBe('Ideas');
    expect(created.directoryId).toBeNull();
    expect(createDocument).toHaveBeenCalledTimes(1);
  });
});
