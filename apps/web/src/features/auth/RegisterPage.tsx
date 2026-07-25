import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { AuthField } from './AuthField';
import { AuthFormError } from './AuthFormError';
import { AuthPageLayout, AuthSubmitButton } from './AuthPageLayout';
import { useAuthStore } from './auth.store';
import { readRedirectTarget } from './redirect-target';

const PASSWORD_RULE =
  'La contraseña debe tener al menos 12 caracteres e incluir una letra y un número.';

/** Mismas reglas que `RegisterRequestDto`: avisar aquí evita una ida y vuelta segura de fallar. */
function isPasswordAcceptable(password: string): boolean {
  return password.length >= 12 && /[A-Za-z]/.test(password) && /\d/.test(password);
}

export function RegisterPage(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  const serverError = useAuthStore((state) => state.error);
  const register = useAuthStore((state) => state.register);

  const navigate = useNavigate();
  const location = useLocation();
  const destination = readRedirectTarget(location.state);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [passwordRejected, setPasswordRejected] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate(destination, { replace: true });
    }
  }, [status, destination, navigate]);

  const busy = status === 'authenticating';
  const message = passwordRejected ? PASSWORD_RULE : serverError;

  const submit = (): void => {
    const acceptable = isPasswordAcceptable(password);
    setPasswordRejected(!acceptable);

    if (!acceptable) {
      return;
    }

    const trimmedName = displayName.trim();

    void register({
      email,
      password,
      // Se omite en vez de mandarse vacío: el DTO valida `@Length(1, 80)` cuando está presente.
      ...(trimmedName === '' ? {} : { displayName: trimmedName }),
    });
  };

  return (
    <AuthPageLayout
      title="Crear cuenta"
      footer={
        <>
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="font-medium text-blue-700 underline hover:text-blue-900">
            Iniciar sesión
          </Link>
        </>
      }
    >
      <AuthFormError message={message} />

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <AuthField
          id="email"
          label="Correo electrónico"
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onValueChange={setEmail}
        />

        <AuthField
          id="password"
          label="Contraseña"
          type="password"
          autoComplete="new-password"
          maxLength={128}
          required
          hint={PASSWORD_RULE}
          value={password}
          onValueChange={setPassword}
          {...(passwordRejected ? { problem: 'No cumple las reglas indicadas.' } : {})}
        />

        <AuthField
          id="displayName"
          label="Nombre (opcional)"
          type="text"
          autoComplete="name"
          maxLength={80}
          value={displayName}
          onValueChange={setDisplayName}
        />

        <AuthSubmitButton busy={busy}>Crear cuenta</AuthSubmitButton>
      </form>
    </AuthPageLayout>
  );
}
