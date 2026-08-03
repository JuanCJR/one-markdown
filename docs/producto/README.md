# Contexto de producto — One Markdown

Paquete pensado para **subirlo a un proyecto de Claude Cowork** y trabajar One Markdown a nivel de
producto: qué es, qué hay construido, qué está decidido y qué no, y qué preguntas hay que responder
para decidir lo siguiente.

No es documentación técnica. El detalle de implementación vive en `specs/**`, `IMPLEMENTATION.md` y
`docs/retrospectivas/`, y **no hace falta leerlo para decidir producto**.

## Los seis documentos

| Archivo | Para qué sirve |
|---|---|
| [`01-que-es.md`](01-que-es.md) | Qué es la herramienta hoy y qué se sabe (y qué no) del usuario al que va dirigida |
| [`02-estado-del-producto.md`](02-estado-del-producto.md) | Inventario de lo que una persona puede hacer hoy, con sus límites numéricos |
| [`03-decisiones-tomadas.md`](03-decisiones-tomadas.md) | Decisiones de producto ya cerradas, con su razón y el coste de revertirlas |
| [`04-huecos-y-candidatos.md`](04-huecos-y-candidatos.md) | Lo que no existe, agrupado, con coste relativo y dependencias |
| [`05-restricciones.md`](05-restricciones.md) | Restricciones de proceso, técnicas y de entorno que condicionan cualquier decisión |
| [`06-preguntas-abiertas.md`](06-preguntas-abiertas.md) | Las preguntas que el repositorio **no** responde. Es el trabajo pendiente de producto |

## Cómo leer estos documentos

1. **Todo dato numérico o de comportamiento sale del código o de las specs**, no de impresiones. Donde
   hay una suposición está marcada como tal.
2. **Lo que no está decidido se dice, no se rellena.** El repositorio tiene mucha ingeniería y casi
   ninguna estrategia de producto: no hay usuario objetivo definido, ni competencia analizada, ni
   distribución, ni métricas. Ese vacío es el punto de partida, no un descuido a disimular.
3. **Fecha de corte: 2026-08-01**, con las siete specs (`000`…`006`) cerradas.

## Regla de mantenimiento

La retrospectiva del proyecto (§2.4) registra que la documentación de seguimiento creció sin cota
hasta que costaba más leer el estado que hacer el cambio. Este paquete nace con la lección aplicada:
**seis archivos, ninguno de más de dos pantallas**. Si algo crece, se corta o se enlaza al detalle en
`specs/`.
