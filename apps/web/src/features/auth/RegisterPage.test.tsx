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

function renderRegister(): TestRouter {
  const router = createMemoryRouter(routes, { initialEntries: ['/register'] });
  render(<RouterProvider router={router} />);

  return router;
}

async function fillValidForm(): Promise<void> {
  await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'nueva@example.test');
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
  expect(window.localStorage.length).toBe(0);
  expect(window.sessionStorage.length).toBe(0);

  vi.unstubAllGlobals();
});

describe('RegisterPage (AC-22)', () => {
  it('tiene un único h1', () => {
    stubApi({});
    renderRegister();

    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
  });

  it('etiqueta cada campo y pide una contraseña nueva al gestor de contraseñas', () => {
    stubApi({});
    renderRegister();

    expect(screen.getByLabelText(/correo electrónico/i)).toHaveAttribute('autocomplete', 'email');
    expect(screen.getByLabelText(/^contraseña$/i)).toHaveAttribute('autocomplete', 'new-password');
    expect(screen.getByLabelText(/nombre/i)).toHaveAttribute('autocomplete', 'name');
  });

  it('ofrece un camino de vuelta al login', () => {
    stubApi({});
    renderRegister();

    expect(screen.getByRole('link', { name: /iniciar sesión|entrar/i })).toHaveAttribute(
      'href',
      '/login',
    );
  });

  it('dice CUÁNTOS caracteres faltan, en el campo, sin gastar una petición', async () => {
    // La fase 6 retira «No cumple las reglas indicadas» y la repetición de la regla como error
    // (§4.4): quien escribió seis caracteres necesita saber que le faltan **seis**, y contarlos a
    // mano en un campo de contraseña es imposible porque los puntos no se cuentan.
    //
    // Y el problema vive **en el campo**, no en el aviso de cabecera: ese queda para lo que viene
    // del servidor. Se afirma que el campo lo describe, que es lo que oye un lector de pantalla.
    const api = stubApi({});
    renderRegister();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'nueva@example.test');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), 'corta1');
    await userEvent.click(screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i }));

    const password = screen.getByLabelText(/^contraseña$/i);

    expect(password).toHaveAttribute('aria-invalid', 'true');
    expect(password).toHaveAccessibleDescription(/Te faltan 6 caracteres\./);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(api.calls).toHaveLength(0);
  });

  it('enumera un problema por fallo: la cifra que falta, la letra y el número', async () => {
    const api = stubApi({});
    renderRegister();

    await userEvent.type(screen.getByLabelText(/correo electrónico/i), 'nueva@example.test');
    await userEvent.type(screen.getByLabelText(/^contraseña$/i), '....');
    await userEvent.click(screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i }));

    const descripcion = screen.getByLabelText(/^contraseña$/i);

    expect(descripcion).toHaveAccessibleDescription(/Te faltan 8 caracteres\./);
    expect(descripcion).toHaveAccessibleDescription(/Añade una letra\./);
    expect(descripcion).toHaveAccessibleDescription(/Añade un número\./);
    expect(api.calls).toHaveLength(0);
  });

  it('muestra el 409 del servidor en un role="alert" que recibe el foco', async () => {
    stubApi({
      'POST /api/auth/register': () => apiErrorResponse(409, 'El correo ya está registrado'),
    });
    renderRegister();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i }));

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('El correo ya está registrado');
    expect(alert).toHaveFocus();
  });

  it('deshabilita el botón mientras la petición está en vuelo', async () => {
    const pending = deferredResponse();
    stubApi({ 'POST /api/auth/register': () => pending.response });
    renderRegister();

    await fillValidForm();

    const submit = screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i });
    await userEvent.click(submit);

    expect(submit).toBeDisabled();

    pending.resolveWith(jsonResponse(authSession(), 201));

    await waitFor(() => {
      expect(useAuthStore.getState().status).toBe('authenticated');
    });
  });

  it('tras el alta entra directamente en la aplicación, sin paso de activación', async () => {
    const api = stubApi({
      'POST /api/auth/register': () => jsonResponse(authSession(), 201),
    });
    const router = renderRegister();

    await userEvent.type(screen.getByLabelText(/nombre/i), 'Ada');
    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe('/');
    });
    expect(api.calls[0]?.body).toEqual({
      email: 'nueva@example.test',
      password: 'contrasena-1234',
      displayName: 'Ada',
    });
  });

  it('omite displayName cuando no se rellena, en vez de mandar una cadena vacía', async () => {
    const api = stubApi({ 'POST /api/auth/register': () => jsonResponse(authSession(), 201) });
    renderRegister();

    await fillValidForm();
    await userEvent.click(screen.getByRole('button', { name: /crear (el archivo|tu archivo)/i }));

    await waitFor(() => {
      expect(api.calls[0]?.body).toEqual({
        email: 'nueva@example.test',
        password: 'contrasena-1234',
      });
    });
  });
});
