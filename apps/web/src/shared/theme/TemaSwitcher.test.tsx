import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';

import { TemaSwitcher } from './TemaSwitcher';
import { LLAVE_TEMA } from './tema';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset['tema'];
});

describe('conmutador de tema', () => {
  it('ofrece las tres opciones como un grupo de radio con nombre accesible', () => {
    render(<TemaSwitcher />);

    const grupo = screen.getByRole('group', { name: 'Tema' });

    expect(grupo).toBeInTheDocument();
    for (const rotulo of ['Claro', 'Oscuro', 'Sistema']) {
      expect(screen.getByRole('radio', { name: rotulo })).toBeInTheDocument();
    }
  });

  it('sin preferencia guardada arranca en «Sistema» y no escribe nada en <html>', () => {
    render(<TemaSwitcher />);

    expect(screen.getByRole('radio', { name: 'Sistema' })).toBeChecked();
    expect(document.documentElement.dataset['tema']).toBeUndefined();
  });

  it('elegir «Oscuro» pinta y persiste', async () => {
    const usuario = userEvent.setup();
    render(<TemaSwitcher />);

    await usuario.click(screen.getByRole('radio', { name: 'Oscuro' }));

    expect(document.documentElement.dataset['tema']).toBe('oscuro');
    expect(window.localStorage.getItem(LLAVE_TEMA)).toBe('oscuro');
    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
  });

  it('volver a «Sistema» devuelve el mando al sistema operativo', async () => {
    const usuario = userEvent.setup();
    render(<TemaSwitcher />);
    await usuario.click(screen.getByRole('radio', { name: 'Claro' }));

    await usuario.click(screen.getByRole('radio', { name: 'Sistema' }));

    expect(document.documentElement.dataset['tema']).toBeUndefined();
    expect(window.localStorage.getItem(LLAVE_TEMA)).toBeNull();
  });

  it('al montar refleja la preferencia ya guardada', () => {
    window.localStorage.setItem(LLAVE_TEMA, 'oscuro');

    render(<TemaSwitcher />);

    expect(screen.getByRole('radio', { name: 'Oscuro' })).toBeChecked();
  });

  /**
   * El presupuesto de acento (§4) da cromo a «el presente» y a la acción primaria. Un conmutador de
   * ajustes no es ninguna de las dos: se distingue por peso y por tinta, no gastando el amarillo.
   */
  it('no gasta presupuesto de acento', () => {
    const { container } = render(<TemaSwitcher />);

    expect(container.querySelectorAll('[data-cromo]')).toHaveLength(0);
    expect(container.innerHTML).not.toContain('cromo');
  });
});
