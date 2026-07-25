/**
 * Usuario autenticado que el guard deja en la petición.
 *
 * Es la interfaz que consumirá la spec `002-workspace-tree`: `id` es la **única** fuente de
 * propiedad de documentos y directorios (`CLAUDE.md`), y `sid` identifica la sesión concreta desde
 * la que se hizo la petición (lo necesita `mfa/disable` para no cerrar la sesión actual).
 *
 * No lleva `passwordHash` ni `mfaSecret` a propósito: lo que no está aquí no puede filtrarse por
 * descuido en un DTO de respuesta.
 */
export interface AuthenticatedUser {
  readonly id: string;
  readonly email: string;
  readonly displayName: string | null;
  readonly mfaEnabled: boolean;
  readonly createdAt: Date;
  readonly sid: string;
}

export function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const candidate: Record<string, unknown> = { ...value };

  return (
    typeof candidate['id'] === 'string' &&
    typeof candidate['email'] === 'string' &&
    (typeof candidate['displayName'] === 'string' || candidate['displayName'] === null) &&
    typeof candidate['mfaEnabled'] === 'boolean' &&
    candidate['createdAt'] instanceof Date &&
    typeof candidate['sid'] === 'string'
  );
}
