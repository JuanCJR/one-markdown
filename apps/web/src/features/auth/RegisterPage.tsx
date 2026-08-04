import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';

import { AuthField } from './AuthField';
import { AuthFormError } from './AuthFormError';
import { AuthPageLayout, AuthSubmitButton } from './AuthPageLayout';
import { useAuthStore } from './auth.store';
import { readRedirectTarget } from './redirect-target';
import { CREAR_CUENTA, problemasDeContrasena } from '../../shared/textos/textos';

/**
 * Las reglas de la contraseña ya no viven aquí: `problemasDeContrasena` las tiene y devuelve **qué
 * falta**, no si vale. La comprobación se hace preguntando si esa lista está vacía, así que la regla
 * y el mensaje no pueden separarse — que es exactamente cómo la fase 0 acabó con una sola cadena
 * sirviendo de ayuda y de error a la vez.
 */

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
  // Qué le faltaba a la contraseña **en el último envío**, no mientras se teclea: señalar tres
  // problemas a quien va por el cuarto carácter es regañar por adelantado.
  const [passwordProblems, setPasswordProblems] = useState<readonly string[]>([]);

  useEffect(() => {
    if (status === 'authenticated') {
      void navigate(destination, { replace: true });
    }
  }, [status, destination, navigate]);

  const busy = status === 'authenticating';
  // El aviso de cabecera queda para lo que viene del servidor. Lo que le falta a la contraseña se
  // dice **en su campo**, que es donde se arregla, y por eso ya no hay una cadena que sirva para las
  // dos cosas.
  const message = serverError;

  const submit = (): void => {
    const problems = problemasDeContrasena(password);

    setPasswordProblems(problems);

    if (problems.length > 0) {
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
      title={CREAR_CUENTA.titulo}
      footer={
        <>
          {CREAR_CUENTA.pie}{' '}
          <Link
            to="/login"
            className="font-medium text-tinta underline hover:bg-tinta hover:text-sup-base"
          >
            {CREAR_CUENTA.entrar}
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
          label={CREAR_CUENTA.correo}
          type="email"
          autoComplete="email"
          maxLength={254}
          required
          value={email}
          onValueChange={setEmail}
        />

        <AuthField
          id="password"
          label={CREAR_CUENTA.contrasena}
          type="password"
          autoComplete="new-password"
          maxLength={128}
          required
          hint={CREAR_CUENTA.ayudaContrasena}
          value={password}
          onValueChange={setPassword}
          problems={passwordProblems}
        />

        <AuthField
          id="displayName"
          label={CREAR_CUENTA.nombre}
          type="text"
          autoComplete="name"
          maxLength={80}
          value={displayName}
          onValueChange={setDisplayName}
        />

        <AuthSubmitButton busy={busy}>{CREAR_CUENTA.enviar}</AuthSubmitButton>
      </form>
    </AuthPageLayout>
  );
}
