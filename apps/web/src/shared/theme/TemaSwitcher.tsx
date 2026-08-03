import { useState } from 'react';

import { TEMAS, type Tema, aplicaTema, rotuloDe, temaGuardado } from './tema';

/**
 * Conmutador de tema. Vive en la cabecera, junto al resto de acciones de la sesión, y no en una
 * pantalla de ajustes de apariencia: `/settings/security` sigue siendo la única pantalla de
 * ajustes (decisión de `docs/design/04-color.md` §0).
 *
 * Radios de verdad, no botones: son tres opciones excluyentes y así el grupo se recorre con las
 * flechas y se anuncia como grupo sin que haya que reimplementar nada a mano. El círculo se oculta
 * (`sr-only`), pero el control que recibe el foco y el teclado sigue siendo el `input`.
 *
 * No gasta cromo: el estado elegido se dice con peso y tinta. El amarillo es para «el presente» y
 * para la acción primaria, y aquí no hay ninguna de las dos.
 */
export function TemaSwitcher(): React.JSX.Element {
  // El estado inicial se lee una sola vez; quien ya ha pintado el `<html>` antes que React es el
  // script de arranque de `index.html`, así que aquí no hay nada que sincronizar al montar.
  const [tema, setTema] = useState<Tema>(() => temaGuardado());

  return (
    <fieldset
      className="flex items-center gap-2"
      // `role="group"` explícito: un `fieldset` sin él no siempre se expone como grupo, y el
      // nombre accesible tiene que llegar de la `legend`.
      role="group"
      aria-label="Tema"
    >
      <legend className="sr-only">Tema</legend>

      {TEMAS.map((opcion) => {
        const elegido = opcion === tema;

        return (
          <label
            key={opcion}
            className="cursor-pointer text-[11px] tracking-[0.22em] uppercase has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-current"
          >
            <input
              type="radio"
              name="tema"
              value={opcion}
              checked={elegido}
              onChange={() => {
                setTema(opcion);
                aplicaTema(opcion);
              }}
              className="sr-only"
            />
            <span className={elegido ? 'text-tinta font-black' : 'text-tinta-tenue'}>
              {rotuloDe(opcion)}
            </span>
          </label>
        );
      })}
    </fieldset>
  );
}
