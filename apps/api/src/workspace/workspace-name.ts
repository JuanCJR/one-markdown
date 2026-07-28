import { MAX_DIRECTORY_NAME_LENGTH, MAX_DOCUMENT_TITLE_LENGTH } from './workspace.constants';

/**
 * Dominio puro de los nombres del workspace: normalización, clave de unicidad y validación
 * (`plan.md` §3 de la spec 002).
 *
 * Este módulo **no importa nada** de Nest, de Prisma ni de HTTP (decisión 14 del plan): es una función
 * de texto a texto, y sus tests no montan infraestructura. Quien necesite un `400` traduce
 * `InvalidWorkspaceNameError` en la frontera (DTO o servicio).
 */

/** Un nombre de directorio y un título de documento se validan igual, pero con máximos distintos. */
export type WorkspaceNameKind = 'directory' | 'document';

/** Motivo por el que un nombre se rechaza. La frontera lo usa para redactar el mensaje del `400`. */
export type InvalidWorkspaceNameReason =
  | 'EMPTY'
  | 'TOO_LONG'
  | 'CONTROL_CHARACTER'
  | 'PATH_SEPARATOR'
  | 'RESERVED';

const MAX_LENGTH_BY_KIND: Readonly<Record<WorkspaceNameKind, number>> = {
  directory: MAX_DIRECTORY_NAME_LENGTH,
  document: MAX_DOCUMENT_TITLE_LENGTH,
};

/**
 * Caracteres de control C0 (`U+0000`–`U+001F`) y `DEL` (`U+007F`).
 *
 * Los que además son espacio en blanco (tabulador, saltos de línea) ya desaparecieron en la
 * normalización, que los colapsa a un espacio; lo que llega aquí es control de verdad.
 */
const LAST_C0_CONTROL = 0x1f;
const DELETE_CONTROL = 0x7f;

/**
 * Se recorren los puntos de código en vez de usar una clase de caracteres en una expresión regular a
 * propósito: esa clase obliga a meter controles dentro del literal, que es justo lo que deja el archivo
 * ilegible para `grep` y para `git diff` (y lo que la regla `no-control-regex` prohíbe).
 */
function hasControlCharacter(value: string): boolean {
  for (const character of value) {
    const codePoint = character.codePointAt(0) ?? 0;

    if (codePoint <= LAST_C0_CONTROL || codePoint === DELETE_CONTROL) {
      return true;
    }
  }

  return false;
}

/**
 * Separadores de ruta. Se rechazan porque estos nombres acaban en `breadcrumbs` y, si algún día hay
 * exportación, en nombres de fichero. El resto de caracteres «prohibidos en Windows» (`:`, `*`, `?`,
 * `"`, `<`, `>`, `|`) se **permiten**: el almacenamiento es una base de datos, no un sistema de
 * ficheros.
 */
const PATH_SEPARATORS = /[/\\]/u;

/** Nombres reservados en cualquier jerarquía. */
const RESERVED_NAMES: readonly string[] = ['.', '..'];

/** Cualquier secuencia de espacio en blanco Unicode, incluido el espacio duro. */
const WHITESPACE_RUN = /\s+/gu;

function messageFor(reason: InvalidWorkspaceNameReason, maxLength: number | undefined): string {
  switch (reason) {
    case 'EMPTY':
      return 'El nombre no puede estar vacío.';
    case 'TOO_LONG':
      return maxLength === undefined
        ? 'El nombre es demasiado largo.'
        : `El nombre no puede tener más de ${String(maxLength)} caracteres.`;
    case 'CONTROL_CHARACTER':
      return 'El nombre no puede contener caracteres de control.';
    case 'PATH_SEPARATOR':
      return 'El nombre no puede contener «/» ni «\\».';
    case 'RESERVED':
      return 'El nombre «.» y el nombre «..» están reservados.';
  }
}

/** Nombre rechazado. Es un error de dominio, sin nada de HTTP dentro. */
export class InvalidWorkspaceNameError extends Error {
  readonly reason: InvalidWorkspaceNameReason;

  constructor(reason: InvalidWorkspaceNameReason, maxLength?: number) {
    super(messageFor(reason, maxLength));

    this.name = 'InvalidWorkspaceNameError';
    this.reason = reason;
  }
}

/**
 * Forma canónica **visible** de un nombre, en este orden:
 *
 * 1. `NFC`, para que las dos representaciones Unicode del mismo texto («á» compuesta y descompuesta) no
 *    produzcan dos carpetas que se ven idénticas.
 * 2. Colapso de cada secuencia de espacio en blanco a un solo espacio, y `trim` de los extremos.
 *
 * Conserva la caja que eligió el usuario: esto es lo que se guarda en `name`/`title` y lo que se
 * devuelve. Es idempotente.
 */
export function normalizeWorkspaceName(value: string): string {
  return value.normalize('NFC').replace(WHITESPACE_RUN, ' ').trim();
}

/**
 * Clave de unicidad entre hermanos: la forma canónica en minúsculas.
 *
 * Se usa `toLowerCase()`, que aplica la conversión por defecto de Unicode e **ignora el locale del
 * proceso**. La variante sensible al locale daría claves distintas en una máquina turca (`I` → `ı`)
 * que en el CI, y el mismo nombre acabaría duplicado según dónde se creara (riesgo #3 de la spec).
 *
 * No hay plegado de diacríticos, a propósito: `Año` y `Ano` son nombres distintos y deben serlo.
 */
export function workspaceNameKey(value: string): string {
  return normalizeWorkspaceName(value).toLowerCase();
}

/**
 * Comprueba que un nombre es válido para su tipo, o lanza `InvalidWorkspaceNameError`.
 *
 * Normaliza antes de comprobar (la normalización es idempotente, así que da igual si quien llama ya lo
 * hizo en el `@Transform` del DTO): todas las reglas del plan se aplican **sobre la forma canónica**,
 * que es la que se va a guardar.
 *
 * La longitud se mide en unidades UTF-16 (`String#length`), no en puntos de código: es lo mismo que
 * cuenta `@MaxLength` en el DTO, y dos criterios distintos dejarían un hueco entre la validación y el
 * dominio.
 */
export function assertWorkspaceName(value: string, kind: WorkspaceNameKind): void {
  const name = normalizeWorkspaceName(value);
  const maxLength = MAX_LENGTH_BY_KIND[kind];

  if (name.length === 0) {
    throw new InvalidWorkspaceNameError('EMPTY');
  }

  if (name.length > maxLength) {
    throw new InvalidWorkspaceNameError('TOO_LONG', maxLength);
  }

  if (hasControlCharacter(name)) {
    throw new InvalidWorkspaceNameError('CONTROL_CHARACTER');
  }

  if (PATH_SEPARATORS.test(name)) {
    throw new InvalidWorkspaceNameError('PATH_SEPARATOR');
  }

  if (RESERVED_NAMES.includes(name)) {
    throw new InvalidWorkspaceNameError('RESERVED');
  }
}
