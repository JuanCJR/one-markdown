import { render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import { MarkdownPalette } from './MarkdownPalette';
import {
  MARKDOWN_PALETTE,
  PALETTE_GROUP_LABELS,
  type PaletteElement,
  type PaletteGroup,
} from './markdown-palette';

/**
 * Barra de elementos markdown (AC-24, AC-25 y la mitad de AC-27).
 *
 * Todo lo que este archivo espera se **deriva de `MARKDOWN_PALETTE`**, nunca se copia a mano: el
 * catálogo es el contrato (lo afirma entero `markdown-palette.test.ts`) y duplicar aquí sus
 * dieciséis etiquetas solo crearía un segundo sitio que actualizar. En particular el número de
 * botones sale de `MARKDOWN_PALETTE.length`, que es la corrección de la v0.1.2: son **16**, no 14.
 *
 * Y el orden —de pintado y de las flechas— se deriva del **catálogo**, no de las claves de
 * `PALETTE_GROUP_LABELS`: el orden de las claves de un objeto no es contrato de nada, así que un
 * test que lo afirmara ataría la navegación con teclado a un detalle que nadie defiende.
 */

/** Los grupos en el orden en que el **catálogo** los presenta. */
const GROUPS_IN_CATALOG_ORDER: readonly PaletteGroup[] = [
  ...new Set(MARKDOWN_PALETTE.map((element) => element.group)),
];

/** Índice con guarda: `noUncheckedIndexedAccess` está activo y aquí un hueco es un fallo del test. */
function at<T>(items: readonly T[], index: number): T {
  const item = items[index];

  if (item === undefined) {
    throw new Error(`No hay elemento en la posición ${index}`);
  }

  return item;
}

function elementsOfGroup(group: PaletteGroup): readonly PaletteElement[] {
  return MARKDOWN_PALETTE.filter((element) => element.group === group);
}

function renderPalette(): Mock<(element: PaletteElement) => void> {
  const onInsert = vi.fn<(element: PaletteElement) => void>();

  render(<MarkdownPalette onInsert={onInsert} />);

  return onInsert;
}

function buttons(): readonly HTMLElement[] {
  return screen.getAllByRole('button');
}

/** La única parada de tabulación de la paleta, tal y como la ve el navegador. */
function tabStops(): readonly HTMLElement[] {
  return buttons().filter((button) => button.tabIndex === 0);
}

/**
 * El nombre accesible de la región viva de la paleta (AC-27). Sale de su `aria-label` y **no** de su
 * contenido: el contenido cambia con cada inserción y empieza vacío, así que no sirve para
 * identificarla, y la página del editor tiene además la región del guardado de la `003`.
 */
const LIVE_REGION_NAME = 'Elemento insertado';

function liveRegion(): HTMLElement {
  return screen.getByRole('status', { name: LIVE_REGION_NAME });
}

/**
 * Cuenta los cambios del contenido de un nodo (AC-36).
 *
 * El recuento se cierra con `takeRecords()`, que devuelve lo que quede pendiente **de forma
 * síncrona**, sin esperar a la microtarea del observador ni al reloj. El callback está porque el
 * navegador —y jsdom— vacían la cola en **cada** punto de comprobación de microtareas, y `await
 * user.click()` cruza unos cuantos: sin acumular ahí, `takeRecords()` al final devolvería solo lo
 * ocurrido después del último `await`. Lo que se afirma sigue siendo el número de cambios reales del
 * DOM, no el mecanismo que los provoca.
 */
function watchChanges(node: HTMLElement): { readonly count: () => number } {
  const seen: MutationRecord[] = [];
  const observer = new MutationObserver((records) => {
    seen.push(...records);
  });

  observer.observe(node, { childList: true, characterData: true, subtree: true });

  return {
    count: (): number => {
      seen.push(...observer.takeRecords());
      observer.disconnect();

      return seen.length;
    },
  };
}

let user: UserEvent;

beforeEach(() => {
  user = userEvent.setup();
});

describe('MarkdownPalette — estructura y nombres accesibles (AC-24)', () => {
  it('es una barra de herramientas con nombre y con los grupos del catálogo rotulados', () => {
    renderPalette();

    const toolbar = screen.getByRole('toolbar', { name: 'Elementos de markdown' });
    const groups = within(toolbar).getAllByRole('group');

    expect(groups).toHaveLength(GROUPS_IN_CATALOG_ORDER.length);

    // Los rótulos se **leen** de `PALETTE_GROUP_LABELS` (T-005): el componente no los declara, así
    // que el nombre accesible de un grupo tiene un solo dueño y un solo test.
    GROUPS_IN_CATALOG_ORDER.forEach((group, index) => {
      expect(at(groups, index)).toHaveAccessibleName(PALETTE_GROUP_LABELS[group]);
    });
  });

  it('pinta un botón por elemento del catálogo, en su orden y dentro de su grupo', () => {
    renderPalette();

    const all = buttons();

    expect(all).toHaveLength(MARKDOWN_PALETTE.length);

    MARKDOWN_PALETTE.forEach((element, index) => {
      const button = at(all, index);

      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAccessibleName(element.label);
      // Y **no** hay `title`: la fase 6 retira los veinte del producto (§4.12). Duplicaban el nombre
      // accesible en un tooltip que solo existe con ratón, así que no añadían nada a quien va con
      // teclado y añadían una segunda cadena que mantener. Se afirma la ausencia, no se deja de
      // mirar: sin esta línea, volver a poner el `title` no rompería nada.
      expect(button).not.toHaveAttribute('title');
    });

    GROUPS_IN_CATALOG_ORDER.forEach((group, index) => {
      const inGroup = within(at(screen.getAllByRole('group'), index)).getAllByRole('button');

      expect(inGroup.length, PALETTE_GROUP_LABELS[group]).toBe(elementsOfGroup(group).length);

      elementsOfGroup(group).forEach((element, position) => {
        expect(at(inGroup, position)).toHaveAccessibleName(element.label);
      });
    });
  });

  it('los iconos no contribuyen al nombre accesible ni al orden de tabulación', () => {
    renderPalette();

    const icons = document.querySelectorAll('svg');

    expect(icons).toHaveLength(MARKDOWN_PALETTE.length);

    icons.forEach((icon) => {
      expect(icon).toHaveAttribute('aria-hidden', 'true');
      expect(icon).toHaveAttribute('focusable', 'false');
    });
  });
});

describe('MarkdownPalette — roving tabindex (AC-25)', () => {
  it('es UNA sola parada de tabulación: uno con tabIndex 0 y el resto con -1', async () => {
    renderPalette();

    const all = buttons();

    expect(all.filter((button) => button.tabIndex === 0)).toHaveLength(1);
    expect(all.filter((button) => button.tabIndex === -1)).toHaveLength(
      MARKDOWN_PALETTE.length - 1,
    );

    await user.tab();

    expect(at(all, 0)).toHaveFocus();

    // Y no captura el tabulador: la segunda pulsación sale de la paleta (SC 2.1.2).
    await user.tab();

    all.forEach((button) => {
      expect(button).not.toHaveFocus();
    });
  });

  it('las flechas recorren los dieciséis en orden del catálogo, cruzando grupos y envolviendo', async () => {
    renderPalette();

    await user.tab();

    // El recorrido entero, elemento a elemento: si las flechas siguieran cualquier otro orden —el
    // alfabético, el de las claves de los rótulos, o cada grupo por su cuenta— esto cae en el
    // primer cruce de grupo.
    for (const element of MARKDOWN_PALETTE) {
      expect(document.activeElement, element.label).toHaveAccessibleName(element.label);

      await user.keyboard('{ArrowRight}');
    }

    // Dieciséis pasos a la derecha desde el primero vuelven al primero (envolver por el extremo).
    expect(document.activeElement).toHaveAccessibleName(at(MARKDOWN_PALETTE, 0).label);

    await user.keyboard('{ArrowLeft}');

    expect(document.activeElement).toHaveAccessibleName(
      at(MARKDOWN_PALETTE, MARKDOWN_PALETTE.length - 1).label,
    );

    // La parada de tabulación **se mueve con el foco**: si se quedara en el primero, volver a la
    // paleta con el tabulador aterrizaría donde la persona no lo dejó.
    expect(tabStops()).toEqual([document.activeElement]);
  });

  it('Home y End van al primero y al último', async () => {
    renderPalette();

    await user.tab();
    await user.keyboard('{End}');

    expect(document.activeElement).toHaveAccessibleName(
      at(MARKDOWN_PALETTE, MARKDOWN_PALETTE.length - 1).label,
    );

    await user.keyboard('{Home}');

    expect(document.activeElement).toHaveAccessibleName(at(MARKDOWN_PALETTE, 0).label);
  });
});

describe('MarkdownPalette — activación y región viva (AC-25, AC-27)', () => {
  it('Enter sobre el botón enfocado inserta su elemento del catálogo', async () => {
    const onInsert = renderPalette();

    await user.tab();
    await user.keyboard('{ArrowRight}{Enter}');

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(at(MARKDOWN_PALETTE, 1));
  });

  it('Espacio sobre el botón enfocado inserta su elemento del catálogo', async () => {
    const onInsert = renderPalette();

    await user.tab();
    await user.keyboard('{ArrowRight}{ArrowRight} ');

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(at(MARKDOWN_PALETTE, 2));
  });

  it('el clic inserta y deja la parada de tabulación donde se pulsó', async () => {
    const onInsert = renderPalette();
    const element = at(MARKDOWN_PALETTE, MARKDOWN_PALETTE.length - 1);

    await user.click(screen.getByRole('button', { name: element.label }));

    expect(onInsert).toHaveBeenCalledTimes(1);
    expect(onInsert).toHaveBeenCalledWith(element);
    expect(tabStops()).toEqual([screen.getByRole('button', { name: element.label })]);
  });

  it('monta su región viva DESDE EL PRIMER RENDER, con nombre y vacía, y escribe en ella al insertar', async () => {
    renderPalette();

    // La región existe **antes** de tener nada que decir. Un lector de pantalla registra las
    // regiones vivas que encuentra y anuncia sus **cambios**; una que entra en el DOM con su texto
    // ya dentro puede no anunciarse nunca en NVDA o JAWS, que es como este AC estuvo verde en CI y
    // falso en la práctica hasta la v0.2.0.
    const region = liveRegion();

    expect(region).toBeEmptyDOMElement();

    // Y se distingue **por nombre**, no por lo que dice: el `role="status"` del guardado de la `003`
    // convive con esta en la página del editor, y su nombre es lo único que no cambia con el estado.
    expect(region).toHaveAccessibleName(LIVE_REGION_NAME);

    await user.click(screen.getByRole('button', { name: 'Negrita' }));

    expect(liveRegion()).toHaveTextContent('Insertado: Negrita');

    await user.click(screen.getByRole('button', { name: 'Tabla' }));

    expect(liveRegion()).toHaveTextContent('Insertado: Tabla');
  });

  it('vuelve a anunciar al insertar DOS VECES el mismo elemento (AC-36)', async () => {
    renderPalette();

    const region = liveRegion();
    const changes = watchChanges(region);
    const bold = screen.getByRole('button', { name: 'Negrita' });

    await user.click(bold);
    await user.click(bold);

    // El estado final de dos inserciones iguales es idéntico al de una, y por eso este AC no se
    // puede afirmar mirando la pantalla: lo que se mide es que la región **cambió** las dos veces.
    // Escribir en ella el mismo texto que ya tenía no muta el DOM y no anuncia nada, así que quien
    // pulsa «Negrita» dos veces oiría el primer anuncio y nada más aunque el documento cambiara las
    // dos. Se cuentan los cambios, no el truco que los produce: la implementación es libre de
    // vaciar y reescribir o de variar el texto de forma imperceptible.
    expect(changes.count()).toBeGreaterThanOrEqual(2);
    expect(region).toHaveTextContent('Insertado: Negrita');
  });
});
