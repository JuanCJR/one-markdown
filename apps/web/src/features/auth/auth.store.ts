import type { AuthSession, AuthUser } from '@one-markdown/shared';
import { create } from 'zustand';

import { describeAuthError } from './auth.errors';
import {
  configureAuthBridge,
  getMe,
  login as loginRequest,
  logout as logoutRequest,
  refreshSession,
  register as registerRequest,
  verifyMfa as verifyMfaRequest,
  type LoginInput,
  type RegisterInput,
} from '../../shared/api/http';

/**
 * `unknown` es el estado de arranque y **no** significa "anónimo": mientras el refresh silencioso
 * está en vuelo no se sabe nada, así que las rutas protegidas esperan en vez de redirigir. Si
 * redirigieran, cada recarga de página mandaría a `/login` a alguien con sesión válida.
 */
export type AuthStatus = 'unknown' | 'authenticating' | 'authenticated' | 'anonymous';

/** La contraseña ya se validó; solo falta el segundo factor. */
export interface PendingMfa {
  readonly mfaToken: string;
}

export interface AuthState {
  readonly status: AuthStatus;
  readonly user: AuthUser | null;
  /**
   * Solo en memoria (AC-23). El store no lleva middleware de persistencia a propósito: un token de
   * acceso en `localStorage` es legible por cualquier XSS y sobrevive al cierre del navegador.
   */
  readonly accessToken: string | null;
  readonly pendingMfa: PendingMfa | null;
  readonly error: string | null;

  /** Refresh silencioso al arrancar la aplicación. Nunca lanza. */
  bootstrap: () => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  login: (input: LoginInput) => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  /** Abandona el desafío de segundo factor y vuelve al formulario de credenciales. */
  cancelMfa: () => void;
  logout: () => Promise<void>;
  /** Relee el usuario del token; el cliente HTTP se encarga del refresh si hace falta. */
  loadCurrentUser: () => Promise<void>;
  /** Adopta un usuario devuelto por otro endpoint (por ejemplo la baja de MFA). */
  applyUser: (user: AuthUser) => void;
}

export const useAuthStore = create<AuthState>()((set, get) => {
  const applySession = (session: AuthSession): void => {
    set({
      status: 'authenticated',
      user: session.user,
      accessToken: session.accessToken,
      pendingMfa: null,
      error: null,
    });
  };

  const failWith = (cause: unknown): void => {
    set({ status: 'anonymous', error: describeAuthError(cause) });
  };

  return {
    status: 'unknown',
    user: null,
    accessToken: null,
    pendingMfa: null,
    error: null,

    bootstrap: async () => {
      try {
        await refreshSession();
      } catch {
        // El puente ya dejó el estado en anónimo. Nadie pidió esta petición, así que no hay error
        // que mostrar: entrar sin sesión a `/login` es el resultado normal.
      }
    },

    register: async (input) => {
      set({ status: 'authenticating', error: null });

      try {
        applySession(await registerRequest(input));
      } catch (cause) {
        set({ user: null, accessToken: null });
        failWith(cause);
      }
    },

    login: async (input) => {
      set({ status: 'authenticating', error: null, pendingMfa: null });

      try {
        const result = await loginRequest(input);

        if (result.mfaRequired) {
          if (result.mfaToken === null) {
            set({
              status: 'anonymous',
              error: 'La API pidió segundo factor sin entregar un token.',
            });

            return;
          }

          set({
            status: 'anonymous',
            user: null,
            accessToken: null,
            pendingMfa: { mfaToken: result.mfaToken },
            error: null,
          });

          return;
        }

        if (result.session === null) {
          set({ status: 'anonymous', error: 'La API no devolvió sesión ni pidió segundo factor.' });

          return;
        }

        applySession(result.session);
      } catch (cause) {
        set({ user: null, accessToken: null });
        failWith(cause);
      }
    },

    verifyMfa: async (code) => {
      const pending = get().pendingMfa;

      if (pending === null) {
        set({ status: 'anonymous', error: 'La verificación caducó. Vuelve a iniciar sesión.' });

        return;
      }

      set({ status: 'authenticating', error: null });

      try {
        applySession(await verifyMfaRequest({ mfaToken: pending.mfaToken, code }));
      } catch (cause) {
        // `pendingMfa` se conserva: el código puede haberse teclado mal y el desafío sigue vivo.
        failWith(cause);
      }
    },

    cancelMfa: () => {
      // El `mfaToken` se descarta sin avisar al servidor: caduca solo en minutos y quien vuelve al
      // login va a generar otro. Quedarse atrapado en el paso del código sí sería un problema.
      set({ status: 'anonymous', pendingMfa: null, error: null });
    },

    logout: async () => {
      try {
        await logoutRequest();
      } catch {
        // El logout es idempotente por diseño: si el servidor falla, la sesión local se cierra
        // igual. Quedarse dentro tras pedir salir es el peor resultado posible.
      }

      set({ status: 'anonymous', user: null, accessToken: null, pendingMfa: null, error: null });
    },

    loadCurrentUser: async () => {
      try {
        set({ user: await getMe() });
      } catch {
        // Un `401` irrecuperable ya pasó por `onSessionLost`; cualquier otro fallo no debe tirar
        // al usuario de la aplicación.
      }
    },

    applyUser: (user) => {
      set({ user });
    },
  };
});

/**
 * El cliente HTTP no importa el store (sería un ciclo): el store se registra en él. Es un efecto de
 * módulo a propósito, para que cualquier consumidor del store tenga el puente ya montado.
 */
configureAuthBridge({
  getAccessToken: () => useAuthStore.getState().accessToken,
  onSessionRenewed: (session) => {
    useAuthStore.setState({
      status: 'authenticated',
      user: session.user,
      accessToken: session.accessToken,
      pendingMfa: null,
    });
  },
  onSessionLost: () => {
    useAuthStore.setState({
      status: 'anonymous',
      user: null,
      accessToken: null,
      pendingMfa: null,
    });
  },
});
