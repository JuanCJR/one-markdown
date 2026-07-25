import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter } from 'react-router';
import { RouterProvider } from 'react-router/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { useAuthStore } from './auth.store';
import { routes } from '../../app/routes';
import { apiErrorResponse, deferredResponse, jsonResponse, stubApi } from '../../test/api-stub';
import { authSession } from '../../test/auth-fixtures';

type TestRouter = ReturnType<typeof createMemoryRouter>;

function renderLogin(from?: string): TestRouter {
  const router = createMemoryRouter(routes, {
    initialEntries: [from === undefined ? '/login' : { pathname: '/login', state: { from } }],
  });
  render(<RouterProvider router={router} />);

  return router;
}

function sessionResponse(): Response {
  return jsonResponse({
    mfaRequired: false,
    session: authSession({ accessToken: 'access-token-login' }),
    mfaToken: null,
    mfaTokenExpiresInSeconds: null,
  });
}

async function fillCredentials(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'ada@example.test');
  await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'contrasena-1234');
}

beforeEach(() => {
  useAuthStore.setState({
    status: 'anonymous',
    user: null,
    accessToken: null,
    pendingMfa: null,
    error: null,
  });
});

afterEach(() => {
  // AC-23: el access token no aparece en ningún almacenamiento del navegador, en ningún caso.
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.unstubAllGlobals();
});

describe('LoginPage — formulario de credenciales (AC-22)', () => {
  it('tiene un único h1', () => {
    stubApi({});
    renderLogin();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('etiqueta cada campo y declara el autoComplete que espera el gestor de contraseñas', () => {
    stubApi({});
    renderLogin();

    const email = screen.getByLabelText(/correo electrónico/i);
    expect(email).toHaveAttribute('type', 'email');
    expect(email).toHaveAttribute('autocomplete', 'email');

    const password = screen.getByLabelText(/^contraseña$/i);
    expect(password).toHaveAttribute('type', 'password');
    expect(password).toHaveAttribute('autocomplete', 'current-password');
  });

  it('ofrece un camino a crear cuenta', () => {
    stubApi({});
    renderLogin();

    expect(screen.getByRole('link', { name: /crear (una )?cuenta/i })).toHaveAttribute(
      'href',
      '/register',
    );
  });

  it('muestra el error del servidor en un contenedor role="alert" que recibe el foco', async () => {
    stubApi({ 'POST /api/auth/login': () => apiErrorResponse(401, 'Credenciales inválidas') });
    renderLogin();

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Credenciales inválidas');
    expect(alert).toHaveFocus();
  });

  it('con la cuenta bloqueada dice cuánto hay que esperar en vez de un error genérico', async () => {
    stubApi({
      'POST /api/auth/login': () =>
        apiErrorResponse(429, 'Demasiados intentos', { retryAfterSeconds: 900 }),
    });
    renderLogin();

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/15 minutos/);
  });

  it('deshabilita el botón mientras la petición está en vuelo', async () => {
    const pending = deferredResponse();
    stubApi({ 'POST /api/auth/login': () => pending.response });
    renderLogin();

    await fillCredentials();

    const submit = screen.getByRole('button', { name: /entrar/i });
    await userEvent.click(submit);

    expect(submit).toBeDisabled();

    pending.resolveWith(sessionResponse());

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });
  });

  it('con credenciales correctas aterriza en el destino guardado', async () => {
    stubApi({ 'POST /api/auth/login': () => sessionResponse() });
    const router = renderLogin('/documentos/uno');

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documentos/uno');
    });
  });

  it('sin destino guardado entra a la raíz de la aplicación', async () => {
    stubApi({ 'POST /api/auth/login': () => sessionResponse() });
    const router = renderLogin();

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
  });

  it('manda el correo y la contraseña tecleados', async () => {
    const api = stubApi({ 'POST /api/auth/login': () => sessionResponse() });
    renderLogin();

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    await waitFor(() => {
      expect(api.calls[0]?.body).toEqual({
        email: 'ada@example.test',
        password: 'contrasena-1234',
      });
    });
  });
});

function mfaRequiredResponse(): Response {
  return jsonResponse({
    mfaRequired: true,
    session: null,
    mfaToken: 'mfa-token-1',
    mfaTokenExpiresInSeconds: 300,
  });
}

/** Deja la vista en el paso de segundo factor, como llega quien tiene MFA activo. */
async function reachMfaStep(): Promise<void> {
  await fillCredentials();
  await userEvent.click(screen.getByRole('button', { name: /entrar/i }));
  await screen.findByLabelText(/código de verificación/i);
}

describe('LoginPage — paso de segundo factor (AC-23)', () => {
  it('pide el código de un solo uso y retira el campo de contraseña', async () => {
    stubApi({ 'POST /api/auth/login': () => mfaRequiredResponse() });
    renderLogin();

    await fillCredentials();
    await userEvent.click(screen.getByRole('button', { name: /entrar/i }));

    const code = await screen.findByLabelText(/código de verificación/i);
    expect(code).toHaveAttribute('autocomplete', 'one-time-code');
    expect(code).toHaveAttribute('inputmode', 'numeric');

    expect(screen.queryByLabelText(/^contraseña$/i)).not.toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('lleva el foco al campo del código, para no obligar a buscarlo', async () => {
    stubApi({ 'POST /api/auth/login': () => mfaRequiredResponse() });
    renderLogin();

    await reachMfaStep();

    expect(screen.getByLabelText(/código de verificación/i)).toHaveFocus();
  });

  it('un código incorrecto se muestra en el role="alert" y conserva el mfaToken para reintentar', async () => {
    let verifyCalls = 0;
    const api = stubApi({
      'POST /api/auth/login': () => mfaRequiredResponse(),
      'POST /api/auth/mfa/verify': () => {
        verifyCalls += 1;

        return verifyCalls === 1
          ? apiErrorResponse(401, 'Código inválido')
          : jsonResponse(authSession({ accessToken: 'access-token-mfa' }));
      },
    });
    renderLogin();

    await reachMfaStep();

    await userEvent.type(screen.getByLabelText(/código de verificación/i), '000000');
    await userEvent.click(screen.getByRole('button', { name: /verificar/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('Código inválido');
    expect(alert).toHaveFocus();
    expect(screen.getByLabelText(/código de verificación/i)).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText(/código de verificación/i));
    await userEvent.type(screen.getByLabelText(/código de verificación/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verificar/i }));

    await waitFor(() => {
      expect(api.callsTo('POST /api/auth/mfa/verify')).toHaveLength(2);
    });
    // El segundo intento reutiliza el mismo desafío: no se perdió el mfaToken con el fallo.
    expect(api.callsTo('POST /api/auth/mfa/verify')[1]?.body).toEqual({
      mfaToken: 'mfa-token-1',
      code: '123456',
    });
  });

  it('con el código correcto entra en el destino pedido y el token no toca ningún storage', async () => {
    stubApi({
      'POST /api/auth/login': () => mfaRequiredResponse(),
      'POST /api/auth/mfa/verify': () =>
        jsonResponse(authSession({ accessToken: 'access-token-mfa' })),
    });
    const router = renderLogin('/documentos/uno');

    await reachMfaStep();

    await userEvent.type(screen.getByLabelText(/código de verificación/i), '123456');
    await userEvent.click(screen.getByRole('button', { name: /verificar/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/documentos/uno');
    });

    // AC-23: el token existe en memoria y en ningún otro sitio.
    expect(useAuthStore.getState().accessToken).toBe('access-token-mfa');
    expect(window.localStorage.length).toBe(0);
    expect(window.sessionStorage.length).toBe(0);
  });

  it('acepta también un código de recuperación con formato XXXX-XXXX', async () => {
    const api = stubApi({
      'POST /api/auth/login': () => mfaRequiredResponse(),
      'POST /api/auth/mfa/verify': () => jsonResponse(authSession()),
    });
    renderLogin();

    await reachMfaStep();

    await userEvent.type(screen.getByLabelText(/código de verificación/i), 'AAAA-1111');
    await userEvent.click(screen.getByRole('button', { name: /verificar/i }));

    await waitFor(() => {
      expect(api.callsTo('POST /api/auth/mfa/verify')[0]?.body).toEqual({
        mfaToken: 'mfa-token-1',
        code: 'AAAA-1111',
      });
    });
  });

  it('permite volver a las credenciales sin recargar, para corregir la cuenta', async () => {
    stubApi({ 'POST /api/auth/login': () => mfaRequiredResponse() });
    renderLogin();

    await reachMfaStep();

    await userEvent.click(screen.getByRole('button', { name: /otra cuenta/i }));

    expect(screen.getByLabelText(/^contraseña$/i)).toBeInTheDocument();
    expect(screen.queryByLabelText(/código de verificación/i)).not.toBeInTheDocument();
  });
});
