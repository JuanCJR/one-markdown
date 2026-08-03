---
name: stop-and-report
description: Contrato de parada - los seis casos en que quien ejecuta una tarea especificada debe parar y avisar en vez de resolverlo por su cuenta, y qué hace quien la escribió cuando eso ocurre. Úsala al recibir una tarea para implementar, al escribir tareas para otro, y siempre que una aserción, un comando o un criterio no cuadre con lo que la tarea predecía. Incluye las comprobaciones previas a delegar y la regla de no debilitar aserciones.
metadata:
  origin: one-markdown
  layer: metodo-portable
---

# Parar y avisar

**El trabajo más valioso de quien ejecuta una tarea no es implementarla: es detectar que la tarea está
mal escrita y decirlo.**

Quien ejecuta choca con la realidad; quien revisa solo lee un resultado. Las propiedades que se ven
únicamente **ejecutando** —la caja real de un control, un comando que no filtra nada, un componente
que se desmonta entre dos repintados— no las encuentra ninguna revisión de lectura.

Y el corolario incómodo: **un ejecutor que «arregla» el problema para que pase produce el mismo verde
y destruye la señal**. Ajustar una aserción para que encaje con lo que salió cuesta lo mismo que
avisar, y borra el defecto en vez de encontrarlo.

## Cuándo cargar esta skill

Al recibir una tarea especificada por otro · al escribir tareas que ejecutará otro · cuando el rojo
que sale no es el que la tarea predecía · cuando necesitas tocar un archivo que la tarea no enumera.

## Los seis casos en que se para

1. **La lista de artefactos se queda corta.** Necesitas tocar un archivo que la tarea no enumera.
   Causa casi siempre la misma: el radio de un cambio de tipo incluye **todo lo que construye un valor
   del tipo**, *fixtures* de test incluidos.
2. **El comando de verificación no ejecuta lo que dice.** Sale «no se encontraron tests», filtra cero
   casos, o pasa sin haber corrido nada. Lo peligroso es que **sale en verde**.
3. **El criterio de aceptación es inalcanzable o se contradice.** Pide algo que la estructura o el
   contrato no permiten, o su propio comando de verificación lo desmiente. Un criterio con una cifra
   pero **sin la ventana en que se mide** suele ser de este tipo.
4. **El requisito vive solo en el plan y no tiene criterio que lo cuente.** Si nada lo verifica, nadie
   lo revisará al comprobar cobertura, y se cuela.
5. **El rojo esperado no es el que ocurre.** Reporta **el que ocurre**. Un fallo de importación no es
   un RED: es andamiaje que falta.
6. **Tu propia aserción pasaría igual sin el cambio.** ¿Qué mutación la tumbaría? Si no se te ocurre
   ninguna, no mide lo que crees.

## Cómo se reporta

**Qué esperabas · qué ocurrió · la salida real · qué propones.**

La salida real, no un resumen de la salida real. Quien decide necesita la medición, no tu lectura de
la medición.

## La regla inversa, que importa igual

**No debilites una aserción para que pase.** Si un criterio no se cumple, **gana el criterio** hasta
que quien especificó decida otra cosa, y esa decisión se escribe.

Caso extremo del mismo error: **un test que demuestra que un límite existe no se neutraliza para que
la suite pase** — eso destruye la única prueba de que el límite está puesto.

## Cinco de los seis casos son culpa de quien escribió la tarea

Por eso, antes de delegar, comprueba tú:

1. **¿Están TODOS los artefactos?** Incluidos los *fixtures* que construyen el tipo que se toca.
2. **¿El comando de verificación ejecuta de verdad lo que dice? Córrelo antes de escribirlo.**
3. **¿El criterio es alcanzable, y su comando puede desmentirlo?**
4. **¿Cada requisito del plan tiene un criterio que lo cuente?**
5. **¿El rojo que predices es el que va a ocurrir?** Si la tarea estrena un módulo, pide el andamio.
6. **¿Qué mutación tumbaría cada test que pides?** Escríbela en la tarea.

## Qué hace quien recibe el reporte

**Una parada es el sistema funcionando, no una interrupción.**

1. **Cree la medición, no el resumen.** Pide la salida real si no vino.
2. **Decide tú**, no quien ejecuta: autorizar el artefacto extra, corregir el criterio, corregir el
   comando, o cambiar la spec. Lo que toque documentos lo escribes tú.
3. **Si el hallazgo cambia un criterio, sube la versión de la spec** con el motivo escrito y la
   medición delante.
4. **Nunca resuelvas una parada debilitando la aserción.**
5. **Un verde sin rojo previo no es una tarea verificada**: exige la verificación por mutación.
