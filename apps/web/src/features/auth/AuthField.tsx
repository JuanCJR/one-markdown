interface AuthFieldProps {
  readonly id: string;
  readonly label: string;
  readonly type: 'email' | 'password' | 'text';
  /** Obligatorio: sin el valor correcto el gestor de contraseñas estorba en vez de ayudar. */
  readonly autoComplete: 'email' | 'current-password' | 'new-password' | 'one-time-code' | 'name';
  readonly value: string;
  readonly onValueChange: (value: string) => void;
  readonly required?: boolean;
  /** Ayuda permanente (reglas del campo), enlazada con `aria-describedby`. */
  readonly hint?: string;
  /** Problema concreto de este campo: marca `aria-invalid` y se enlaza también. */
  readonly problem?: string;
  readonly inputMode?: 'numeric';
  readonly maxLength?: number;
  /**
   * Solo para un campo que **aparece** como consecuencia de una acción de la persona (el paso de
   * segundo factor): dejarla buscando el control recién aparecido es peor que mover el foco.
   */
  readonly autoFocus?: boolean;
}

export function AuthField({
  id,
  label,
  type,
  autoComplete,
  value,
  onValueChange,
  required = false,
  hint,
  problem,
  inputMode,
  maxLength,
  autoFocus = false,
}: AuthFieldProps): React.JSX.Element {
  const hintId = `${id}-hint`;
  const problemId = `${id}-problem`;
  const describedBy = [hint === undefined ? null : hintId, problem === undefined ? null : problemId]
    .filter((token): token is string => token !== null)
    .join(' ');

  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-tinta">
        {label}
      </label>

      <input
        id={id}
        name={id}
        type={type}
        value={value}
        required={required}
        autoComplete={autoComplete}
        inputMode={inputMode}
        maxLength={maxLength}
        autoFocus={autoFocus}
        aria-invalid={problem === undefined ? undefined : true}
        aria-describedby={describedBy === '' ? undefined : describedBy}
        onChange={(event) => {
          onValueChange(event.target.value);
        }}
        className="block min-h-11 w-full border border-hair-control bg-sup-base px-3 py-2 text-tinta outline-none focus:border-tinta aria-invalid:border-l-4 aria-invalid:border-l-tinta"
      />

      {hint === undefined ? null : (
        <p id={hintId} className="mt-1 text-xs text-tinta-secundaria">
          {hint}
        </p>
      )}

      {problem === undefined ? null : (
        <p id={problemId} className="mt-1 text-xs font-medium text-tinta">
          {problem}
        </p>
      )}
    </div>
  );
}
