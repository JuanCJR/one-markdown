import type { MfaSetup } from '@one-markdown/shared';
import { useState } from 'react';
import { Link } from 'react-router';

import { AuthField } from './AuthField';
import { AuthFormError } from './AuthFormError';
import { AuthSubmitButton } from './AuthPageLayout';
import { describeAuthError } from './auth.errors';
import { useAuthStore } from './auth.store';
import { mfaDisable, mfaEnable, mfaSetup } from '../../shared/api/http';
import { CODIGO, CREAR_CUENTA, SEGURIDAD } from '../../shared/textos/textos';
import { useTituloDePestana } from '../../shared/textos/useTituloDePestana';

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

  useTituloDePestana(SEGURIDAD.titulo);

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
    <div className="min-h-screen bg-sup-elevada px-4 py-10">
      <main className="mx-auto w-full max-w-xl bg-sup-base p-6">
        <h1 className="text-xl font-semibold text-tinta">{SEGURIDAD.titulo}</h1>

        {/*
          El estado va en **una** cadena y no en un tronco más un adjetivo concatenado: partirlo
          dejaba a un lector de pantalla leyendo «Verificación en dos pasos, dos puntos, activada»,
          y a quien traduzca mañana, con media frase.
        */}
        <p role="status" className="mt-2 text-sm text-tinta-secundaria">
          {mfaEnabled ? SEGURIDAD.estadoActivada : SEGURIDAD.estadoDesactivada}
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

        <p className="mt-8 pt-4 text-sm">
          <Link
            to="/"
            className="font-medium text-tinta underline hover:bg-tinta hover:text-sup-base"
          >
            {SEGURIDAD.volver}
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
        <h2 className="text-base font-medium text-tinta">{SEGURIDAD.seccion}</h2>
        <p className="mt-1 mb-4 text-sm text-tinta-secundaria">{SEGURIDAD.invitacion}</p>
        <button
          type="button"
          disabled={busy}
          aria-busy={busy}
          onClick={onStart}
          data-cromo="primaria"
          className="min-h-11 bg-cromo px-4 py-2 font-black text-sobre-cromo outline-none hover:bg-tinta hover:text-sup-base focus-visible:foco-cromo disabled:cursor-not-allowed disabled:inerte disabled:text-tinta-desactivada"
        >
          {SEGURIDAD.activar}
        </button>
      </section>
    );
  }

  return (
    <section>
      <h2 className="text-base font-medium text-tinta">{SEGURIDAD.escanea}</h2>

      <img
        src={setup.qrCodeDataUrl}
        alt={SEGURIDAD.altQr}
        width={192}
        height={192}
        className="mt-4 bg-sup-base p-2"
      />

      <p className="mt-4 text-sm text-tinta-secundaria">{SEGURIDAD.claveManual}</p>
      {/* Texto seleccionable, no una imagen: sin esto quien no pueda escanear se queda fuera. */}
      <code className="mt-1 block break-all bg-sup-hundida px-2 py-1 font-mono text-sm text-tinta select-all">
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
          label={CODIGO.etiqueta}
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={6}
          required
          autoFocus
          hint={SEGURIDAD.ayudaCodigo}
          value={code}
          onValueChange={onCodeChange}
        />

        <AuthSubmitButton busy={busy}>{SEGURIDAD.confirmar}</AuthSubmitButton>
      </form>
    </section>
  );
}

function RecoveryCodes({ codes }: { readonly codes: readonly string[] }): React.JSX.Element {
  return (
    <section>
      <h2 className="text-base font-medium text-tinta">{SEGURIDAD.codigos}</h2>

      {/*
        Sin `<strong>`: la frase entera va sobre masa de tinta, que es el recurso del sistema para
        «estado que hay que leer», y una negrita dentro de un negativo no destaca nada — compite.
        Lo que antes hacía la negrita («no volverás a verlos») ahora lo hace el orden: la
        consecuencia va la primera.
      */}
      <div role="alert" className="mt-3 bg-tinta px-3 py-2 text-sm text-sup-base">
        {SEGURIDAD.avisoCodigos}
      </div>

      <ul className="mt-4 grid grid-cols-2 gap-2">
        {codes.map((recoveryCode) => (
          <li
            key={recoveryCode}
            className=" bg-sup-hundida px-2 py-1 text-center font-mono text-sm text-tinta select-all"
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
      <h2 className="text-base font-medium text-tinta">{SEGURIDAD.desactivarSeccion}</h2>
      <p className="mt-1 mb-4 text-sm text-tinta-secundaria">{SEGURIDAD.desactivarAviso}</p>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          onSubmit();
        }}
      >
        <AuthField
          id="disablePassword"
          label={CREAR_CUENTA.contrasena}
          type="password"
          autoComplete="current-password"
          maxLength={128}
          required
          value={password}
          onValueChange={onPasswordChange}
        />

        <AuthField
          id="disableCode"
          label={CODIGO.etiqueta}
          type="text"
          autoComplete="one-time-code"
          inputMode="numeric"
          maxLength={9}
          required
          hint={CODIGO.formato}
          value={code}
          onValueChange={onCodeChange}
        />

        <AuthSubmitButton busy={busy}>{SEGURIDAD.desactivar}</AuthSubmitButton>
      </form>
    </section>
  );
}
