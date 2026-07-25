import type { MfaSetup } from '@one-markdown/shared';
import { useState } from 'react';
import { Link } from 'react-router';

import { AuthField } from './AuthField';
import { AuthFormError } from './AuthFormError';
import { AuthSubmitButton } from './AuthPageLayout';
import { describeAuthError } from './auth.errors';
import { useAuthStore } from './auth.store';
import { mfaDisable, mfaEnable, mfaSetup } from '../../shared/api/http';

/**
 * Paso del enrolamiento. El secreto solo existe aquí mientras se confirma: el backend lo guarda
 * cifrado en Redis con TTL y no lo escribe en la base hasta el `enable`.
 */
type Enrollment =
  | { readonly step: 'idle' }
  | { readonly step: 'confirm'; readonly setup: MfaSetup }
  | { readonly step: 'codes'; readonly codes: readonly string[] };

export function SecurityPage(): React.JSX.Element {
  const user = useAuthStore((state) => state.user);
  const applyUser = useAuthStore((state) => state.applyUser);

  const [enrollment, setEnrollment] = useState<Enrollment>({ step: 'idle' });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');

  const mfaEnabled = user?.mfaEnabled ?? false;

  const run = async (action: () => Promise<void>): Promise<void> => {
    setBusy(true);
    setError(null);

    try {
      await action();
    } catch (cause) {
      setError(describeAuthError(cause));
    } finally {
      setBusy(false);
    }
  };

  const startEnrollment = (): void => {
    void run(async () => {
      setEnrollment({ step: 'confirm', setup: await mfaSetup() });
      setCode('');
    });
  };

  const confirmEnrollment = (): void => {
    void run(async () => {
      const { recoveryCodes } = await mfaEnable(code.trim());

      setEnrollment({ step: 'codes', codes: recoveryCodes });
      setCode('');

      if (user !== null) {
        // El `enable` responde con los códigos, no con el usuario: el `mfaEnabled` se deduce del
        // 200. Si el contrato llegase a devolver el usuario, esto se sustituye por `applyUser`.
        applyUser({ ...user, mfaEnabled: true });
      }
    });
  };

  const disable = (): void => {
    void run(async () => {
      applyUser(await mfaDisable({ password, code: code.trim() }));

      setEnrollment({ step: 'idle' });
      setPassword('');
      setCode('');
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 px-4 py-10">
      <main className="mx-auto w-full max-w-xl rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-900">Seguridad de la cuenta</h1>

        <p role="status" className="mt-2 text-sm text-slate-700">
          Verificación en dos pasos: {mfaEnabled ? 'activada' : 'desactivada'}
        </p>

        <div className="mt-6">
          <AuthFormError message={error} />

          {/* Los códigos recién generados manda sobre todo lo demás: acaban de activar MFA y esta
              es la única vez que van a poder verlos. */}
          {enrollment.step === 'codes' ? (
            <RecoveryCodes codes={enrollment.codes} />
          ) : mfaEnabled ? (
            <DisableSection
              busy={busy}
              password={password}
              code={code}
              onPasswordChange={setPassword}
              onCodeChange={setCode}
              onSubmit={disable}
            />
          ) : (
            <EnrollSection
              setup={enrollment.step === 'confirm' ? enrollment.setup : null}
              busy={busy}
              code={code}
              onCodeChange={setCode}
              onStart={startEnrollment}
              onConfirm={confirmEnrollment}
            />
          )}
        </div>

        <p className="mt-8 border-t border-slate-200 pt-4 text-sm">
          <Link to="/" className="font-medium text-blue-700 underline hover:text-blue-900">
            Volver al workspace
          </Link>
        </p>
      </main>
    </div>
  );
}

interface EnrollSectionProps {
  /** `null` mientras no hay setup pendiente: se muestra la invitación a activarlo. */
  readonly setup: MfaSetup | null;
  readonly busy: boolean;
  readonly code: string;
  readonly onCodeChange: (value: string) => void;
  readonly onStart: () => void;
  readonly onConfirm: () => void;
}

function EnrollSection({
  setup,
  busy,
  code,
  onCodeChange,
  onStart,
  onConfirm,
}: EnrollSectionProps): React.JSX.Element {
  if (setup === null) {
    return (
      <section>
        <h2 className="text-base font-medium text-slate-900">Verificación en dos pasos</h2>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Añade un código de tu app de autenticación (Google Authenticator, 1Password, Aegis) al
          iniciar sesión.
        </p>
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={onStart}
          className="min-h-11 rounded-md bg-blue-700 px-4 py-2 font-medium text-white outline-none hover:bg-blue-800 focus-visible:ring-2 focus-visible:ring-blue-700/50 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          Activar verificación en dos pasos
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-base font-medium text-slate-900">Escanea el código</h2>

      <img
        src={setup.qrCodeDataUrl}
        alt="Código QR para añadir esta cuenta a tu app de autenticación"
        width={192}
        height={192}
        className="mt-4 rounded border border-slate-200 bg-white p-2"
      />

      <p className="mt-4 text-sm text-slate-600">
        Si no puedes escanearlo, escribe esta clave en tu app:
      </p>
      {/* Texto seleccionable, no una imagen: sin esto quien no pueda escanear se queda fuera. */}
      <code className="mt-1 block break-all rounded bg-slate-100 px-2 py-1 font-mono text-sm text-slate-900 select-all">
        {setup.secret}
      </code>

      <form
        noValidate
        className="mt-6"
        onSubmit={(event) => {
          event.preventDefault();
          onConfirm();
        }}
      >
        <AuthField
          id="enrollCode"
          label="Código de verificación"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          required
          autoFocus
          hint="Los 6 dígitos que muestra tu app ahora mismo."
          value={code}
          onValueChange={onCodeChange}
        />

        <AuthSubmitButton busy={busy}>Confirmar</AuthSubmitButton>
      </form>
    </section>
  );
}

function RecoveryCodes({ codes }: { readonly codes: readonly string[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-base font-medium text-slate-900">Códigos de recuperación</h2>

      <div
        role="alert"
        className="mt-3 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900"
      >
        Guárdalos ahora en un lugar seguro: <strong>no volverás a verlos</strong>. Cada uno sirve
        una sola vez para entrar si pierdes el teléfono.
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {codes.map((recoveryCode) => (
          <li
            key={recoveryCode}
            className="rounded bg-slate-100 px-2 py-1 text-center font-mono text-sm text-slate-900 select-all"
          >
            {recoveryCode}
          </li>
        ))}
      </ul>
    </section>
  );
}

interface DisableSectionProps {
  readonly busy: boolean;
  readonly password: string;
  readonly code: string;
  readonly onPasswordChange: (value: string) => void;
  readonly onCodeChange: (value: string) => void;
  readonly onSubmit: () => void;
}

function DisableSection({
  busy,
  password,
  code,
  onPasswordChange,
  onCodeChange,
  onSubmit,
}: DisableSectionProps): React.JSX.Element {
  return (
    <section>
      <h2 className="text-base font-medium text-slate-900">Desactivar la verificación</h2>
      <p className="mt-1 mb-4 text-sm text-slate-600">
        Se borrarán tu clave TOTP y tus códigos de recuperación, y se cerrarán tus otras sesiones.
      </p>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <AuthField
          id="disablePassword"
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          value={password}
          onValueChange={onPasswordChange}
        />

        <AuthField
          id="disableCode"
          label="Código de verificación"
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={9}
          required
          hint="6 dígitos, o uno de tus códigos de recuperación."
          value={code}
          onValueChange={onCodeChange}
        />

        <AuthSubmitButton busy={busy}>Desactivar verificación en dos pasos</AuthSubmitButton>
      </form>
    </section>
  );
}
