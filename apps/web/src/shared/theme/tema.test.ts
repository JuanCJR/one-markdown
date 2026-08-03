import { afterEach, describe, expect, it, vi } from 'vitest';

import { LLAVE_TEMA, aplicaTema, temaGuardado } from './tema';

afterEach(() => {
  window.localStorage.clear();
  delete document.documentElement.dataset['tema'];
  vi.restoreAllMocks();
});

describe('preferencia de tema', () => {
  it('sin nada guardado manda el sistema operativo', () => {
    expect(temaGuardado()).toBe('sistema');
  });

  it('un valor guardado que no es del sistema se ignora, no se escribe en el html', () => {
    window.localStorage.setItem(LLAVE_TEMA, 'sepia');

    expect(temaGuardado()).toBe('sistema');
  });

  it.each(['claro', 'oscuro'] as const)('«%s» se escribe en <html> y se persiste', (tema) => {
    aplicaTema(tema);

    expect(document.documentElement.dataset['tema']).toBe(tema);
    expect(window.localStorage.getItem(LLAVE_TEMA)).toBe(tema);
    expect(temaGuardado()).toBe(tema);
  });

  it('«sistema» borra el atributo y la preferencia, para devolverle el mando al sistema', () => {
    aplicaTema('oscuro');

    aplicaTema('sistema');

    expect(document.documentElement.dataset['tema']).toBeUndefined();
    expect(window.localStorage.getItem(LLAVE_TEMA)).toBeNull();
    expect(temaGuardado()).toBe('sistema');
  });

  it('si el almacenamiento no deja escribir, el tema se aplica igual', () => {
    // Modo privado de Safari, cuota llena, cookies de terceros bloqueadas: `setItem` lanza. Que no
    // se pueda recordar la preferencia no es motivo para dejar la pantalla sin pintar.
    vi.spyOn(window.localStorage, 'setItem').mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });

    expect(() => {
      aplicaTema('oscuro');
    }).not.toThrow();
    expect(document.documentElement.dataset['tema']).toBe('oscuro');
  });

  it('si el almacenamiento no deja leer, se cae a «sistema» sin romper', () => {
    vi.spyOn(window.localStorage, 'getItem').mockImplementation(() => {
      throw new DOMException('SecurityError');
    });

    expect(temaGuardado()).toBe('sistema');
  });
});
