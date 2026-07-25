import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth.store';
import { routes } from '../../app/routes';
import { apiErrorResponse, jsonResponse, stubApi } from '../../test/api-stub';
import { authUser } from '../../test/auth-fixtures';

type TestRouter = ReturnType<typeof createMemoryRouter>;

const SECRET = 'JBSWY3DPEHPK3PXP';

const RECOVERY_CODES = [
  'AAAA-1111',
  'BBBB-2222',
  'CCCC-3333',
  'DDDD-4444',
  'EEEE-5555',
  'FFFF-6666',
  'GGGG-7777',
  'HHHH-8888',
];

function renderSecurity(): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: ['/settings/security'] });
  render(<RouterProvider router={router} />);

  return router;
}

function signIn(mfaEnabled: boolean): void {
  useAuthStore.setState({
    status: 'authenticated',
    user: authUser({ mfaEnabled }),
    accessToken: 'access-token-1',
    pendingMfa: null,
    error: null,
  });
}

function setupResponse(): Response {
  return jsonResponse({
    secret: SECRET,
    otpauthUri: `otpauth://totp/One%20Markdown:ada@example.test?secret=${SECRET}`,
    qrCodeDataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==',
    expiresInSeconds: 600,
  });
}

function recoveryCodesResponse(): Response {
  return jsonResponse({ recoveryCodes: RECOVERY_CODES, generatedAt: '2026-07-24T00:00:00.000Z' });
}

beforeEach(() => {
  signIn(false);
});

afterEach(() => {
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.unstubAllGlobals();
});

describe('SecurityPage — ruta protegida', () => {
  it('sin sesión redirige a /login', async () => {
    useAuthStore.setState({ status: 'anonymous', user: null, accessToken: null });
    stubApi({});

    const router = renderSecurity();

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/login');
    });
  });

  it('tiene un único h1', () => {
    stubApi({});
    renderSecurity();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });
});

describe('SecurityPage — alta de MFA (AC-13, AC-14 desde la UI)', () => {
  it('dice que la verificación en dos pasos está desactivada y ofrece activarla', () => {
    stubApi({});
    renderSecurity();

    expect(screen.getByRole('status')).toHaveTextContent(/pasos: desactivada/i);
    expect(screen.getByRole('button', { name: /^activar/i })).toBeInTheDocument();
  });

  it('al activar muestra el QR con alt descriptivo y el secreto en texto copiable', async () => {
    stubApi({ 'POST /api/auth/mfa/setup': () => setupResponse() });
    renderSecurity();

    await userEvent.click(screen.getByRole('button', { name: /^activar/i }));

    const qr = await screen.findByRole('img', { name: /código qr/i });
    expect(qr).toHaveAttribute('src', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg==');

    // Quien no pueda escanear tiene que poder copiar el secreto a mano.
    expect(screen.getByText(SECRET)).toBeInTheDocument();
    expect(screen.getByLabelText(/código de verificación/i)).toHaveAttribute(
      'autocomplete',
      'one-time-code',
    );
  });

  it('al confirmar lista los 8 códigos de recuperación avisando de que solo se ven una vez', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/setup': () => setupResponse(),
      'POST /api/auth/mfa/enable': () => recoveryCodesResponse(),
    });
    renderSecurity();

    await userEvent.click(screen.getByRole('button', { name: /^activar/i }));
    await screen.findByRole('img', { name: /código qr/i });

    await userEvent.type(screen.getByLabelText(/código de verificación/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    await waitFor(() => {
      expect(screen.getAllByRole('listitem')).toHaveLength(8);
    });

    for (const code of RECOVERY_CODES) {
      expect(screen.getByText(code)).toBeInTheDocument();
    }

    expect(screen.getByRole('alert')).toHaveTextContent(
      /no volverás a verlos|una (sola|única) vez/i,
    );
    expect(api.calls[1]?.body).toEqual({ code: '123456' });
    expect(useAuthStore.getState().user?.mfaEnabled).toBe(true);
  });

  it('un código inválido muestra el error y deja la verificación sin activar', async () => {
    stubApi({
      'POST /api/auth/mfa/setup': () => setupResponse(),
      'POST /api/auth/mfa/enable': () => apiErrorResponse(401, 'Código incorrecto'),
    });
    renderSecurity();

    await userEvent.click(screen.getByRole('button', { name: /^activar/i }));
    await screen.findByRole('img', { name: /código qr/i });

    await userEvent.type(screen.getByLabelText(/código de verificación/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /confirmar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Código incorrecto');
    expect(alert).toHaveFocus();

    // Sigue en el paso de confirmación y MFA sigue apagado: nada cambió de estado.
    expect(screen.getByLabelText(/código de verificación/i)).toBeInTheDocument();
    expect(screen.queryAllByRole('listitem')).toHaveLength(0);
    expect(useAuthStore.getState().user?.mfaEnabled).toBe(false);
  });
});

describe('SecurityPage — baja de MFA (AC-19 desde la UI)', () => {
  beforeEach(() => {
    signIn(true);
  });

  it('con MFA activo pide contraseña y código, y al confirmar vuelve al estado sin MFA', async () => {
    const api = stubApi({
      'POST /api/auth/mfa/disable': () => jsonResponse(authUser({ mfaEnabled: false })),
    });
    renderSecurity();

    expect(screen.getByRole('status')).toHaveTextContent(/pasos: activada/i);

    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'contrasena-1234');
    await userEvent.type(screen.getByLabelText(/código de verificación/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /^desactivar/i }));

    await waitFor(() => {
      expect(screen.getByRole('status')).toHaveTextContent(/pasos: desactivada/i);
    });

    expect(api.calls[0]?.body).toEqual({ password: 'contrasena-1234', code: '123456' });
    expect(useAuthStore.getState().user?.mfaEnabled).toBe(false);
    expect(screen.getByRole('button', { name: /^activar/i })).toBeInTheDocument();
  });

  it('con la contraseña incorrecta muestra el error y MFA sigue activo', async () => {
    stubApi({
      'POST /api/auth/mfa/disable': () => apiErrorResponse(401, 'Contraseña incorrecta'),
    });
    renderSecurity();

    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'mala');
    await userEvent.type(screen.getByLabelText(/código de verificación/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /^desactivar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Contraseña incorrecta');
    expect(screen.getByRole('status')).toHaveTextContent(/pasos: activada/i);
    expect(useAuthStore.getState().user?.mfaEnabled).toBe(true);
  });

  it('la contraseña de la baja pide el autoComplete de contraseña actual', () => {
    stubApi({});
    renderSecurity();

    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
  });
});
