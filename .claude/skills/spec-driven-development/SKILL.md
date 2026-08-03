---
name: spec-driven-development
description: Método SDD - nada se implementa sin especificación versionada. Úsala antes de planificar cualquier feature, épica o cambio significativo; al escribir, corregir o revisar una spec; y al decidir si un cambio es major, minor o patch. Define los cuatro documentos por feature, el versionado semántico, las reglas de redacción que hacen que un criterio se pueda desmentir, y cuánta especificación conviene escribir por adelantado.
metadata:
  origin: one-markdown
  layer: metodo-portable
---

# Especificación antes que código (SDD)

Ninguna feature se implementa sin especificación. La spec es la fuente de verdad compartida: dice qué
se construye, por qué, y cómo se sabrá que está hecho. Código sin spec es adivinar.

Este documento es **metodología portable**: no nombra ningún proyecto. Las reglas salieron de defectos
reales; los ejemplos de cada proyecto viven en el anexo de sus agentes, no aquí.

## Cuándo cargar esta skill

Antes de planificar una feature o un cambio significativo · al escribir o modificar una spec · al
decidir el número de versión de un cambio · al revisar si una spec está lista para derivar tareas.

Para ejecutar una tarea ya especificada, la skill que aplica es la de TDD, no esta.

## Los cuatro documentos

Toda feature vive en una carpeta propia con cuatro documentos:

| Documento | Contiene |
|---|---|
| `spec.md` | **QUÉ y POR QUÉ**. Criterios de aceptación numerados, cada uno con el mecanismo que lo verifica. |
| `plan.md` | **CÓMO**. Arquitectura, contratos, decisiones **con sus alternativas descartadas**. |
| `tasks.md` | Tareas atómicas, cada una con su test y su comando. |
| `CHANGELOG.md` | Historial de versiones de la spec, con el motivo de cada una. |

El detalle histórico de una feature vive en **su** `CHANGELOG`, no en el índice ni en el documento de
seguimiento. Un índice que crece hasta que cuesta más leerlo que hacer el cambio ha dejado de ser un
índice.

## Versionado semántico de la spec

- **major** — rompe comportamiento observable ya implementado, o rompe un contrato publicado.
- **minor** — añade alcance nuevo sin romper lo existente.
- **patch** — aclara o corrige sin mover el recuento de criterios ni de tareas.

**El recuento es el criterio práctico**: si se mueve, no es patch. Un cambio aditivo que obliga a
tocar aserciones de tests **que ya estaban en verde** tampoco es patch.

Cada cambio de versión deja entrada en el `CHANGELOG` con fecha y motivo.

## Reglas de redacción que se pagan solas

- **Ningún requisito vive solo en el plan.** Si hay que cumplirlo, tiene criterio de aceptación. Un
  requisito sin criterio no lo cuenta nadie al revisar cobertura, y por ese hueco se cuela justo lo
  que el plan daba por dicho.
- **Ningún número derivable de una enumeración se escribe a mano.** El recuento vive en la
  enumeración, en un solo sitio. Dos sitios divergen.
- **Toda cifra lleva pegada la ventana en que se mide y el comando que la mide.** Un número sin
  ventana no es verificable aunque parezca el dato más concreto del criterio: puede ser cierto por
  corrida y falso bajo su propio comando de verificación.
- **Cada criterio dice con qué mecanismo se verifica**, y para cada uno te preguntas **qué mutación lo
  haría caer**. Si no se te ocurre ninguna, el criterio no mide lo que crees.
- **Lo que ningún test del repositorio puede cubrir se declara como tal**, y no se escribe un test que
  finja lo contrario. Una revisión manual declarada es honesta; un test que la simula es un verde
  falso permanente.

## Cuánta spec se escribe por adelantado

La pregunta no es «cuánta spec» sino «qué parte de la spec envejece bien antes de la primera línea».

**Sí, antes de derivar tareas** — decisiones, cotas y alcance. Una decisión estructural tomada con la
aritmética o la medición delante sostiene una implementación entera sin correcciones.

**No, antes del primer test en verde** — las formas exactas de los datos. Fijarlas por adelantado
produce correcciones que no compran nada: se descubre que la forma era irrelevante, y normalizarla
habría añadido una rama que solo su propio test ejercitaría.

El síntoma de haberse pasado es medible: **patches escritos con el código delante**. Unos pocos son
salud —la spec se corrige contra la realidad—; que sean la mitad de las versiones significa que la
spec entró con más detalle del que podía sostener.

## Antes de dar una spec por lista

1. ¿Todo requisito del plan tiene un criterio que lo cuente?
2. ¿Toda cifra tiene ventana y comando?
3. ¿Cada criterio tiene una mutación que lo tumbaría?
4. ¿Los recuentos salen de enumeraciones, no de la memoria?
5. ¿Lo no verificable está declarado como no verificable?
6. ¿Las decisiones que condicionan la implementación están cerradas, y las formas de los datos
   deliberadamente abiertas?
