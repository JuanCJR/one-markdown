# NNN · Tareas

**Versión**: 0.1.0 · Acompaña a `spec.md` 0.1.0 · `plan.md` 0.1.0

Leyenda: `[ ]` pendiente · `[~]` en curso o bloqueada con motivo · `[x]` hecha y verificada.

Cada tarea nombra los ficheros que puede tocar. **Si hace falta uno que no está en la lista, se para
y se avisa** — no se amplía la lista sobre la marcha.

---

- [ ] **T-001 · <ejecutor> · <título>**
  - **Criterios**: AC-N, AC-M
  - **Depende de**: —
  - **Artefactos**: <TODOS los ficheros que puede tocar, tests y *fixtures* incluidos>
  - **RED**: <el test, dónde vive, y **qué fallo se espera ver**>
  - **GREEN**: <la implementación mínima>
  - **DONE**: `pnpm typecheck && pnpm lint && pnpm test`
  - **Mutación**: <qué cambio en el código haría caer este test>

---

## Las tres comprobaciones que se pagan solas

**Artefactos.** El radio de un cambio de tipo incluye **todo lo que construye un valor del tipo**,
*fixtures* de test incluidos, y se encuentra buscando el nombre del **tipo**, no el de la función. Si
hay varios paquetes, en todos los que lo construyan.

**El `DONE` se corre antes de escribirlo.** Un comando que no ejecuta nada sale en verde. Los filtros
de los ejecutores de tests no siempre son expresiones regulares; muchos son subcadena, y un filtro
que no encaja no falla: no encuentra nada.

**La `Mutación` mata los tests tautológicos.** Si no se te ocurre ninguna que tumbe el test, el test
no mide lo que crees. Uno que afirma que un valor vuelve a su estado inicial pasa igual si ninguna de
las operaciones intermedias hace nada.

Y si la tarea **estrena un módulo**, pide el andamio: la firma exportada con cuerpo vacío. Sin él, el
rojo es de resolución y solo demuestra que el fichero no está.
