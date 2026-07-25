import '@testing-library/jest-dom/vitest';

/**
 * `localStorage` y `sessionStorage` reales para el entorno de test.
 *
 * En este jsdom llegan como un objeto vacío sin `setItem` (Node expone su propio `localStorage`
 * incompleto y gana la partida), así que un test que compruebe "el almacenamiento sigue vacío"
 * pasaría por accidente en vez de por mérito. AC-23 exige que el access token no aterrice nunca en
 * el almacenamiento del navegador: para verificarlo hace falta un almacenamiento que de verdad
 * guarde lo que se le mande.
 */
class MemoryStorage {
  private readonly entries = new Map<string, string>();

  get length(): number {
    return this.entries.size;
  }

  key(index: number): string | null {
    return [...this.entries.keys()][index] ?? null;
  }

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, String(value));
  }

  removeItem(key: string): void {
    this.entries.delete(key);
  }

  clear(): void {
    this.entries.clear();
  }
}

for (const name of ['localStorage', 'sessionStorage']) {
  Object.defineProperty(window, name, {
    value: new MemoryStorage(),
    configurable: true,
    writable: true,
  });
}
