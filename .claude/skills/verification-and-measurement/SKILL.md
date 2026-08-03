---
name: verification-and-measurement
description: Cómo se verifica una entrega y cómo no creerse una medida falsa - validar el instrumento antes que el dato, correr desde estado limpio y de uno en uno, distinguir un rojo ancho por hambre de máquina de una regresión, y no citar un documento de seguimiento sin comprobarlo. Úsala antes de dar por buena cualquier cifra, cualquier verde y sobre todo cualquier cero, antes de marcar una tarea como hecha, y al diagnosticar un fallo que no se reproduce.
metadata:
  origin: one-markdown
  layer: metodo-portable
---

# Verificación y medida

Verificar no es leer un informe: es correr el comando y mirar la salida.

Este documento es **metodología portable**: no nombra ningún proyecto ni herramienta.

## Cuándo cargar esta skill

Antes de marcar cualquier cosa como hecha · antes de citar una cifra · al recibir un resultado que
parece limpio · al diagnosticar un rojo ancho o un fallo que no se reproduce.

## Corre tú el comando

No des por verificada una entrega por el informe de quien la hizo. El informe es una fuente
secundaria; la primaria es el comando y su salida.

## Valida el instrumento antes de creerte la medida

**Un cero de un instrumento desconectado es indistinguible de uno real.** Es el error de medición más
caro y más frecuente, y adopta muchas formas:

- una herramienta que **no está instalada** en esta máquina y devuelve vacío;
- una suite que **no ejecutó un solo caso** porque el filtro no encajaba, y reporta cero fallos;
- una corrida que **murió en un paso previo** y dejó los pasos de test en «omitido»;
- una nota de seguimiento que afirma una verificación **que nunca ocurrió**.

La comprobación es siempre la misma: **contrasta el instrumento contra un valor conocido** antes de
creerte el resultado. Si mides «cero errores», demuestra primero que el instrumento sabe encontrar
uno.

## De uno en uno, desde estado limpio

Los comandos se corren desde estado limpio y **de uno en uno**. Preparar o borrar el estado que otra
cosa está usando —regenerar artefactos de compilación mientras corre la suite que los consume— es
desconectar el instrumento sin darse cuenta. La medida sale limpia, y falsa.

## Un rojo ancho puede ser hambre de máquina, no una regresión

Se reconoce por la **duración**: un caso que declara más milisegundos de los que su propio límite
permite, corriendo en paralelo con otros paquetes. Corre el paquete solo antes de diagnosticar.

**No subas el tiempo límite de los tests**: cambia un síntoma ruidoso por uno silencioso.

## Un fallo que no se reproduce no es transitorio

Es «no explicado» hasta que se sabe **por qué** desapareció. «Ya no pasa» no es una causa.

## Fuente primaria y fuente secundaria

**Un dato de un documento de seguimiento no se cita sin comprobarlo.** El seguimiento es una fuente
secundaria: recoge lo que alguien verificó en su momento, y envejece. La primaria es el comando.

Una nota falsa que nadie recomprueba se repite como buena indefinidamente, y cada repetición la hace
parecer más sólida.

## Antes de marcar algo como hecho

1. ¿El test se escribió antes y **falló primero**? ¿Existe la salida real de ese fallo?
2. ¿Cada criterio está cubierto por al menos un test automatizado?
3. ¿Los comandos de verificación globales pasan, corridos por ti?
4. ¿El instrumento estaba conectado —lo demuestra algo?
5. ¿Las reglas duras del proyecto se cumplen?

Lo que queda a medias se marca como tal, **con el motivo y el siguiente paso concreto**.
