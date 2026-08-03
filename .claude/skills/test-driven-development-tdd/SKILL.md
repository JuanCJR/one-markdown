---
name: test-driven-development-tdd
description: Escribe el test primero, míralo fallar por la razón correcta, implementa lo mínimo. Úsala al ejecutar cualquier tarea de implementación o corrección, al derivar un plan de tareas, y siempre que tengas que decidir si un verde está de verdad verificado. Incluye la regla del andamio (un fallo de importación no es un RED), la anatomía de una tarea que no explota y el cálculo del radio de un cambio.
metadata:
  origin: one-markdown
  layer: metodo-portable
---

# Desarrollo dirigido por tests (TDD)

Escribe el test primero. Míralo fallar. Implementa lo mínimo que lo pone en verde.

**Principio**: si no viste el test fallar, no sabes si prueba lo que crees. Un test que nunca estuvo
en rojo no ha demostrado nada todavía.

Este documento es **metodología portable**: no nombra ningún proyecto, ni framework, ni comando. Donde
dice «el comando de verificación», cada proyecto pone el suyo.

## Cuándo cargar esta skill

Siempre que vayas a implementar algo · al derivar tareas de un plan · al revisar los tests que
entrega otro · antes de dar por buena una tarea que salió verde a la primera.

## El ciclo, por tarea

1. **RED** — escribe el test primero y **córrelo**. Debe fallar, y debe fallar **por la razón
   correcta**. Guarda la salida real del fallo: es la prueba de que el test mide algo.
2. **GREEN** — la implementación mínima que lo pone en verde. Nada especulativo.
3. **REFACTOR** — con los tests en verde, no antes.
4. **VERIFICA** — corre los comandos de verificación y conserva **la salida real**, no un resumen.

**Solo se tocan los archivos que la tarea enumera.** Si hace falta otro, se para y se avisa: eso es el
contrato de parada, y tiene skill propia.

## La regla del andamio

Un test que importa un módulo que aún no existe falla por **resolución**, no por aserción. Eso solo
demuestra que el archivo no está —que ya lo sabíamos—.

Si la tarea estrena un módulo, **crea antes el andamio**: la firma exportada con un cuerpo que no hace
nada. Entonces el rojo que obtienes es el de la aserción, que es el que vale.

Corolario para quien escribe la tarea: si predices el rojo de una tarea que estrena módulo y no pides
el andamio, **predecirás mal**.

## Anatomía de una tarea que no explota

```
- [ ] T-NNN · <ejecutor> · <título>
      Criterios: AC-2, AC-3
      Depende de: T-NNN | —
      Artefactos: <TODOS los archivos que la tarea puede tocar, tests y fixtures incluidos>
      RED:   <test que debe fallar, dónde vive, y QUÉ fallo se espera ver>
      GREEN: <implementación mínima esperada>
      DONE:  <comando de verificación>
      Mutación: <qué cambio en el código haría caer este test>
```

### El campo `Artefactos` es la comprobación más rentable

Sin él, un radio de cambio mal calculado es un defecto en producción; con él, es una parada de treinta
segundos.

**Regla para calcularlo**: el radio de un cambio de tipo incluye **todo lo que construye un valor del
tipo** —*fixtures* de test incluidos— y se encuentra buscando el nombre del **tipo**, no el de la
función ni el del endpoint. En un monorepo, en todos los paquetes que lo construyen, no solo en el
que lo declara.

### El campo `DONE` se corre antes de escribirlo

Un comando que no ejecuta nada **sale en verde**, y esa es su trampa. Antes de escribirlo en la tarea,
córrelo y comprueba que ejecuta los casos que dice ejecutar. Los filtros de los ejecutores de tests no
siempre son expresiones regulares; muchos son subcadena, y un filtro que no encaja no falla: no
encuentra nada.

### El campo `Mutación` mata los tests tautológicos

Antes de dar un test por bueno: **¿qué mutación lo tumbaría?** Si no se te ocurre ninguna, el test no
mide lo que crees. Un test que afirma que un valor vuelve a su estado inicial pasa igual si ninguna de
las operaciones intermedias hace nada.

## Un verde sin rojo previo no es una tarea verificada

Si el comportamiento ya existía y el test entra directamente en verde, verifícalo **por mutación**:
rompe la línea, comprueba que el test cae, restáurala. Y deja escrito cuál fue la mutación.

## Cobertura

Cada criterio de aceptación tiene **al menos un test automatizado**. Lo que ningún test del
repositorio puede cubrir se declara como tal —y no se escribe un test que finja lo contrario—.
