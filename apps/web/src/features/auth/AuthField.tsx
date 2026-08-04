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
  /**
   * Los problemas concretos de este campo: marcan `aria-invalid` y se enlazan también.
   *
   * Es una **lista** desde la fase 6, y no una cadena, por lo que pedía §4.4: la contraseña deja de
   * repetir la regla («No cumple las reglas indicadas») y dice qué falta, un problema por fallo y
   * con la cifra. Los tres van dentro del **mismo** contenedor referenciado, para que el lector de
   * pantalla los lea todos al enfocar el campo y no solo el primero.
   */
  readonly problems?: readonly string[];
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
  problems,
  inputMode,
  maxLength,
  autoFocus = false,
}: AuthFieldProps): React.JSX.Element {
  const hintId = `${id}-hint`;
  const problemId = `${id}-problem`;
  const hasProblems = problems !== undefined && problems.length > 0;
  const describedBy = [hint === undefined ? null : hintId, hasProblems ? problemId : null]
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
        aria-invalid={hasProblems ? true : undefined}
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

      {!hasProblems ? null : (
        <div id={problemId} className="mt-1 text-xs font-medium text-tinta">
          {problems.map((problem) => (
            <p key={problem}>{problem}</p>
          ))}
        </div>
      )}
    </div>
  );
}
