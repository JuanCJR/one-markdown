import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  InvalidWorkspaceNameError,
  assertWorkspaceName,
  normalizeWorkspaceName,
  workspaceNameKey,
} from './workspace-name';
import {
  MAX_DIRECTORY_DEPTH,
  MAX_DIRECTORY_NAME_LENGTH,
  MAX_DOCUMENT_CONTENT_CHARS,
  MAX_DOCUMENT_TITLE_LENGTH,
  MAX_WORKSPACE_NODES,
} from './workspace.constants';

/**
 * Los caracteres de control se construyen, **nunca** se escriben como literales: un byte NUL dentro del
 * `.ts` convierte el archivo en binario para `grep` y para `git diff`. Ya pasó con `tasks.md` de esta
 * misma spec y hubo que arreglarlo a mano.
 */
const NUL = String.fromCharCode(0);
const DEL = String.fromCharCode(0x7f);
const UNIT_SEPARATOR = String.fromCharCode(0x1f);

/**
 * `á` como un solo punto de código (NFC, U+00E1) y como `a` + acento combinante (NFD,
 * U+0061 U+0301). Se escriben con escapes porque en pantalla son el mismo glifo y un diff no los
 * distinguiría.
 */
const A_ACENTO_NFC = '\u00e1';
const A_ACENTO_NFD = 'a\u0301';

describe('normalizeWorkspaceName (AC-3, AC-4)', () => {
  it('recorta los extremos', () => {
    expect(normalizeWorkspaceName('  Notas  ')).toBe('Notas');
  });

  it('colapsa cada secuencia interna de espacios en blanco a un solo espacio', () => {
    expect(normalizeWorkspaceName('Mis   notas \t\n de   trabajo')).toBe('Mis notas de trabajo');
  });

  it('conserva la caja que eligió el usuario', () => {
    expect(normalizeWorkspaceName('Notas De Trabajo')).toBe('Notas De Trabajo');
    expect(normalizeWorkspaceName('NOTAS')).toBe('NOTAS');
  });

  it('normaliza a NFC: las dos formas Unicode de «á» dan la misma salida', () => {
    // Sin esto, dos carpetas que se ven idénticas en la barra lateral serían dos filas distintas.
    expect(A_ACENTO_NFC).not.toBe(A_ACENTO_NFD);
    expect(normalizeWorkspaceName(`${A_ACENTO_NFD}rbol`)).toBe(
      normalizeWorkspaceName(`${A_ACENTO_NFC}rbol`),
    );
    expect(normalizeWorkspaceName(`${A_ACENTO_NFD}rbol`)).toBe(`${A_ACENTO_NFC}rbol`);
  });

  it('es idempotente', () => {
    const unaVez = normalizeWorkspaceName('  Mis   notas  ');

    expect(normalizeWorkspaceName(unaVez)).toBe(unaVez);
  });

  it('devuelve cadena vacía si solo había espacios', () => {
    expect(normalizeWorkspaceName('   \t ')).toBe('');
  });

  it('no toca los caracteres de control que no son espacio en blanco', () => {
    expect(normalizeWorkspaceName(`Notas${NUL}`)).toBe(`Notas${NUL}`);
  });
});

describe('workspaceNameKey (AC-3, AC-14)', () => {
  it('devuelve la versión en minúsculas del nombre normalizado', () => {
    expect(workspaceNameKey('  Mis   Notas  ')).toBe('mis notas');
  });

  it('hace que «Notas», «NOTAS» y «  notas  » compartan clave', () => {
    const claves = new Set(['Notas', 'NOTAS', '  notas  '].map(workspaceNameKey));

    expect([...claves]).toEqual(['notas']);
  });

  it('unifica las dos formas Unicode del mismo nombre', () => {
    expect(workspaceNameKey(`${A_ACENTO_NFD}RBOL`)).toBe(workspaceNameKey(`${A_ACENTO_NFC}rbol`));
  });

  it('NO pliega diacríticos: «Año» y «Ano» son nombres distintos', () => {
    expect(workspaceNameKey('Año')).not.toBe(workspaceNameKey('Ano'));
  });

  it('baja la I latina a «i» (conversión Unicode por defecto, no la del locale)', () => {
    // Con `toLocaleLowerCase()` una máquina con locale turco daría `ıdeas` y la clave dejaría de ser
    // la misma en esta máquina, en el CI y en producción (riesgo #3 de la spec).
    expect(workspaceNameKey('IDEAS')).toBe('ideas');
  });
});

describe('assertWorkspaceName (AC-4, AC-13)', () => {
  function reasonOf(fn: () => void): string {
    try {
      fn();
    } catch (error) {
      if (error instanceof InvalidWorkspaceNameError) {
        return error.reason;
      }

      throw error;
    }

    throw new Error('se esperaba que assertWorkspaceName lanzara');
  }

  describe('rechaza', () => {
    it.each([
      ['cadena vacía', '', 'EMPTY'],
      ['solo espacios', '    ', 'EMPTY'],
      ['solo tabuladores y saltos', ' \t\n ', 'EMPTY'],
      ['carácter de control NUL', `Notas${NUL}`, 'CONTROL_CHARACTER'],
      ['carácter de control DEL', `Notas${DEL}`, 'CONTROL_CHARACTER'],
      ['carácter de control U+001F', `No${UNIT_SEPARATOR}tas`, 'CONTROL_CHARACTER'],
      ['barra', 'notas/2026', 'PATH_SEPARATOR'],
      ['barra invertida', 'notas\\2026', 'PATH_SEPARATOR'],
      ['punto', '.', 'RESERVED'],
      ['punto punto', '..', 'RESERVED'],
      ['punto punto con espacios alrededor', '  ..  ', 'RESERVED'],
    ])('%s', (_caso, valor, reason) => {
      expect(() => assertWorkspaceName(valor, 'directory')).toThrow(InvalidWorkspaceNameError);
      expect(reasonOf(() => assertWorkspaceName(valor, 'directory'))).toBe(reason);
    });

    it(`un nombre de directorio de ${String(MAX_DIRECTORY_NAME_LENGTH + 1)} caracteres`, () => {
      expect(reasonOf(() => assertWorkspaceName('a'.repeat(121), 'directory'))).toBe('TOO_LONG');
    });

    it(`un título de documento de ${String(MAX_DOCUMENT_TITLE_LENGTH + 1)} caracteres`, () => {
      expect(reasonOf(() => assertWorkspaceName('a'.repeat(201), 'document'))).toBe('TOO_LONG');
    });

    it('mide la longitud DESPUÉS de normalizar', () => {
      // 120 «a» más espacios que el trim se lleva: cabe.
      expect(() => assertWorkspaceName(`   ${'a'.repeat(120)}   `, 'directory')).not.toThrow();
    });
  });

  describe('acepta', () => {
    it.each([
      ['dos puntos', 'Notas: 2026'],
      ['asterisco', 'Notas *importantes*'],
      ['interrogación', '¿Qué falta?'],
      ['barra vertical', 'Notas | trabajo'],
      ['comillas y ángulos', 'Notas "<buenas>"'],
      ['un emoji', '📁'],
      ['un emoji con texto', '📝 Notas de hoy'],
      ['un punto que no está solo', 'notas.md'],
      ['tres puntos', '...'],
      ['acentos y eñes', 'Año 2026 · Ñandú'],
    ])('%s', (_caso, valor) => {
      expect(() => assertWorkspaceName(valor, 'directory')).not.toThrow();
    });

    it('el máximo exacto de cada tipo', () => {
      expect(() => assertWorkspaceName('a'.repeat(120), 'directory')).not.toThrow();
      expect(() => assertWorkspaceName('a'.repeat(200), 'document')).not.toThrow();
    });

    it('un título de 121 caracteres, que sería demasiado largo para un directorio', () => {
      // El máximo es el del tipo, no uno compartido.
      expect(() => assertWorkspaceName('a'.repeat(121), 'document')).not.toThrow();
    });
  });

  it('lanza un Error con nombre propio (sin depender de Nest para el 400)', () => {
    const error = new InvalidWorkspaceNameError('EMPTY');

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe('InvalidWorkspaceNameError');
    expect(error.message).not.toBe('');
  });
});

describe('workspace.constants (plan §3)', () => {
  it('fija los topes del dominio', () => {
    expect(MAX_DIRECTORY_NAME_LENGTH).toBe(120);
    expect(MAX_DOCUMENT_TITLE_LENGTH).toBe(200);
    expect(MAX_DIRECTORY_DEPTH).toBe(10);
    expect(MAX_DOCUMENT_CONTENT_CHARS).toBe(200_000);
    expect(MAX_WORKSPACE_NODES).toBe(5_000);
  });
});

describe('pureza del módulo de dominio (plan §6)', () => {
  const fuente = readFileSync(join(__dirname, 'workspace-name.ts'), 'utf8');

  it('no importa nada de Nest ni de Prisma', () => {
    const imports = fuente
      .split('\n')
      .filter((linea) => /^\s*(import|export)\b[^;]*\bfrom\b/.test(linea));

    for (const linea of imports) {
      expect(linea).not.toMatch(/@nestjs|@prisma|prisma|generated/i);
    }
  });

  it('usa toLowerCase y nunca toLocaleLowerCase (riesgo #3)', () => {
    expect(fuente).toContain('toLowerCase(');
    expect(fuente).not.toContain('toLocaleLowerCase');
  });

  it('no usa `any`', () => {
    expect(fuente).not.toMatch(/\bany\b/);
  });
});
