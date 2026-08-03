import { useState } from 'react';

import { AuthField } from './AuthField';
import { AuthSubmitButton } from './AuthPageLayout';
import { useAuthStore } from './auth.store';

/**
 * Segundo paso del login: la contraseña ya se validó y el servidor entregó un `mfaToken` de vida
 * corta. Acepta el TOTP de 6 dígitos **o** un código de recuperación `XXXX-XXXX`, porque quien
 * perdió el teléfono tiene que poder entrar por aquí (AC-18).
 */
export function MfaChallengeForm(): React.JSX.Element {
  const status = useAuthStore((state) => state.status);
  const verifyMfa = useAuthStore((state) => state.verifyMfa);
  const cancelMfa = useAuthStore((state) => state.cancelMfa);

  const [code, setCode] = useState('');
  const busy = status === 'authenticating';

  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void verifyMfa(code.trim());
      }}
    >
      <p className="mb-4 text-sm text-tinta-secundaria">
        Tu cuenta tiene verificación en dos pasos. Escribe el código de tu app de autenticación.
      </p>

      <AuthField
        id="mfaCode"
        label="Código de verificación"
        type="text"
        autoComplete="one-time-code"
        inputMode="numeric"
        // 9 caracteres: los 6 dígitos del TOTP o un código de recuperación `XXXX-XXXX`.
        maxLength={9}
        required
        autoFocus
        hint="6 dígitos, o uno de tus códigos de recuperación."
        value={code}
        onValueChange={setCode}
      />

      <AuthSubmitButton busy={busy}>Verificar</AuthSubmitButton>

      <button
        type="button"
        onClick={cancelMfa}
        className="mt-3 min-h-11 w-full px-4 py-2 text-sm text-tinta-secundaria underline outline-none hover:text-tinta focus-visible:foco-cromo"
      >
        Entrar con otra cuenta
      </button>
    </form>
  );
}
