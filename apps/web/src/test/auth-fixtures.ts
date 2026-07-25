import type { AuthSession, AuthUser } from '@one-markdown/shared';

/** Usuario del contrato (`UserResponseDto`), sin MFA salvo que el caso lo pida. */
export function authUser(overrides: Partial<AuthUser> = {}): AuthUser {
  return {
    id: '3f1c6c6e-0b3e-4c0f-9a4b-2b7e9c1d5a11',
    email: 'ada@example.test',
    displayName: 'Ada',
    mfaEnabled: false,
    createdAt: '2026-07-24T00:00:00.000Z',
    ...overrides,
  };
}

/** Sesión del contrato (`AuthSessionResponseDto`). El refresh token no está: viaja en cookie. */
export function authSession(overrides: Partial<AuthSession> = {}): AuthSession {
  return {
    accessToken: 'access-token-1',
    tokenType: 'Bearer',
    expiresInSeconds: 900,
    user: authUser(),
    ...overrides,
  };
}
