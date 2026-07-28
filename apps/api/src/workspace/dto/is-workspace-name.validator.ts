import { registerDecorator, type ValidationArguments, type ValidationOptions } from 'class-validator';

import {
  assertWorkspaceName,
  InvalidWorkspaceNameError,
  type WorkspaceNameKind,
} from '../workspace-name';

/**
 * `@IsWorkspaceName('directory' | 'document')` — puente entre el dominio puro de nombres y el
 * `ValidationPipe` (plan §4 de la spec 002).
 *
 * Existe para que las reglas de nombre vivan **en un solo sitio**: el DTO no reimplementa «sin
 * separadores de ruta, sin controles, distinto de `.` y `..`» con expresiones regulares propias que
 * mañana se desincronizarían de `assertWorkspaceName`. Aquí solo se traduce el error de dominio al
 * formato que el pipe espera.
 *
 * Cuando el valor **no** es una cadena, este validador pasa: quien tiene que protestar es `@IsString`,
 * y dos mensajes para el mismo defecto solo ensucian el `400`.
 */
function failureOf(value: unknown, kind: WorkspaceNameKind): InvalidWorkspaceNameError | null {
  if (typeof value !== 'string') {
    return null;
  }

  try {
    assertWorkspaceName(value, kind);
    return null;
  } catch (error) {
    if (error instanceof InvalidWorkspaceNameError) {
      return error;
    }

    // Cualquier otra cosa es un fallo de programación: se propaga y sale como `500`, no como `400`.
    throw error;
  }
}

export function IsWorkspaceName(
  kind: WorkspaceNameKind,
  validationOptions?: ValidationOptions,
): PropertyDecorator {
  return (target: object, propertyName: string | symbol): void => {
    registerDecorator({
      name: 'isWorkspaceName',
      target: target.constructor,
      propertyName: String(propertyName),
      constraints: [kind],
      ...(validationOptions === undefined ? {} : { options: validationOptions }),
      validator: {
        validate(value: unknown): boolean {
          return failureOf(value, kind) === null;
        },
        // El mensaje empieza por el nombre de la propiedad porque AC-4 exige que el `400` diga
        // **qué campo** se rechazó, no solo por qué.
        defaultMessage(args: ValidationArguments): string {
          const failure = failureOf(args.value, kind);

          return `${args.property}: ${failure?.message ?? 'el nombre no es válido.'}`;
        },
      },
    });
  };
}
