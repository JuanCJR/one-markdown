/**
 * Preferencia de tema. Decisión cerrada en `docs/design/04-color.md` §0:
 * `prefers-color-scheme` manda por defecto, y una preferencia local la puede sobrescribir
 * escribiendo `data-tema` en `<html>` y guardándola en `localStorage`.
 *
 * Coste cero de backend, y por eso mismo la preferencia **no viaja entre dispositivos**: eso es
 * una decisión escrita, no un olvido. Persistirla en servidor (tabla `user_preferences`,
 * `PATCH /api/preferences`) es alcance nuevo y necesita su propia spec.
 *
 * El primer pintado no lo hace este módulo sino el script de arranque de `index.html`, que corre
 * antes de que React exista: si esperásemos a montar, la pantalla daría un destello claro antes
 * de ponerse oscura.
 */

export const LLAVE_TEMA = 'om-tema';

/** `sistema` no es un tema: es «no hay preferencia local, decide el sistema operativo». */
export type Tema = 'claro' | 'oscuro' | 'sistema';

export const TEMAS: readonly Tema[] = ['claro', 'oscuro', 'sistema'];

const ROTULO: Record<Tema, string> = {
  claro: 'Claro',
  oscuro: 'Oscuro',
  sistema: 'Sistema',
};

export function rotuloDe(tema: Tema): string {
  return ROTULO[tema];
}

function esTemaExplicito(valor: string | null): valor is 'claro' | 'oscuro' {
  return valor === 'claro' || valor === 'oscuro';
}

/**
 * Lee la preferencia guardada. Cualquier cosa que no sea `claro` u `oscuro` —basura, una versión
 * futura, o un almacenamiento que lanza porque el navegador está en modo privado— cae en
 * `sistema`, que es el comportamiento por defecto y nunca deja la pantalla en un estado raro.
 */
export function temaGuardado(): Tema {
  try {
    const guardado = window.localStorage.getItem(LLAVE_TEMA);

    return esTemaExplicito(guardado) ? guardado : 'sistema';
  } catch {
    return 'sistema';
  }
}

/**
 * Aplica el tema al documento y lo persiste.
 *
 * El orden importa: primero se pinta, después se guarda. Un `localStorage` que lanza —cuota,
 * modo privado, cookies de terceros bloqueadas— hace que la preferencia no se recuerde en la
 * próxima visita, y eso es todo: no puede impedir que la pantalla se vea como se ha pedido.
 */
export function aplicaTema(tema: Tema): void {
  const html = document.documentElement;

  if (tema === 'sistema') {
    delete html.dataset['tema'];
  } else {
    html.dataset['tema'] = tema;
  }

  try {
    if (tema === 'sistema') {
      window.localStorage.removeItem(LLAVE_TEMA);
    } else {
      window.localStorage.setItem(LLAVE_TEMA, tema);
    }
  } catch {
    // Sin persistencia: la preferencia dura lo que dure la pestaña. Es aceptable y silencioso.
  }
}
