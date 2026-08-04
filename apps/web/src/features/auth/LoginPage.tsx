import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { AuthField } from './AuthField';
import { AuthFormError } from './AuthFormError';
import { AuthPageLayout, AuthSubmitButton } from './AuthPageLayout';
import { MfaChallengeForm } from './MfaChallengeForm';
import { useAuthStore } from './auth.store';
import { readRedirectTarget } from './redirect-target';
import { ENTRAR } from '../../shared/textos/textos';

export function LoginPage(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  const error = useAuthStore((state) => state.error);
  const pendingMfa = useAuthStore((state) => state.pendingMfa);
  const login = useAuthStore((state) => state.login);

  const navigate = useNavigate();
  const location = useLocation();
  const destination = readRedirectTarget(location.state);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate(destination, { replace: true });
    }
  }, [status, destination, navigate]);

  const busy = status === 'authenticating';

  return (
    <AuthPageLayout
      title={ENTRAR.titulo}
      footer={
        <>
          {ENTRAR.pie}{' '}
          <Link
            to="/register"
            className="font-medium text-tinta underline hover:bg-tinta hover:text-sup-base"
          >
            {ENTRAR.crear}
          </Link>
        </>
      }
    >
      <AuthFormError message={error} />

      {pendingMfa === null ? (
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void login({ email, password });
          }}
        >
          <AuthField
            id="email"
            label={ENTRAR.correo}
            type="email"
            autoComplete="email"
            maxLength={254}
            required
            value={email}
            onValueChange={setEmail}
          />

          <AuthField
            id="password"
            label={ENTRAR.contrasena}
            type="password"
            autoComplete="current-password"
            maxLength={128}
            required
            value={password}
            onValueChange={setPassword}
          />

          <AuthSubmitButton busy={busy}>{ENTRAR.enviar}</AuthSubmitButton>
        </form>
      ) : (
        // La contraseña deja de estar en el DOM en cuanto se canjea por el desafío: ya no hace
        // falta y tenerla en un input vivo solo amplía la superficie.
        <MfaChallengeForm />
      )}
    </AuthPageLayout>
  );
}
