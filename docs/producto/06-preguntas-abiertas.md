# 6. Preguntas abiertas — el trabajo de producto pendiente

El repositorio responde con enorme precisión **cómo** está construido One Markdown y **no responde
nada** sobre para quién es y adónde va. Estas son las preguntas, ordenadas: cada una condiciona las
siguientes.

## P0 — ¿Esto es un producto, un ejercicio, o una herramienta para ti?

Las tres son respuestas legítimas y llevan a planes completamente distintos:

- **Herramienta personal**: el siguiente paso es desplegarla para ti y usarla a diario. La búsqueda y
  la exportación se vuelven urgentes; la recuperación de contraseña, el onboarding y el responsive, casi
  irrelevantes.
- **Ejercicio de método** (que es lo que la retrospectiva mide y celebra): el siguiente paso no es una
  feature, es afinar el proceso. Las decisiones de producto pasan a ser pretextos para probar el método.
- **Producto con usuarios**: entonces todo lo de [`04-huecos-y-candidatos.md`](04-huecos-y-candidatos.md)
  §A es bloqueante y hay que decidir distribución, diferenciación y métricas antes de escribir ninguna
  spec nueva.

**Sin esta respuesta, priorizar es adivinar.** Es la primera conversación que hay que tener.

## P1 — ¿Para quién es?

No hay ni una línea de definición de usuario en todo el proyecto. Las preguntas concretas:

- ¿Alguien que **ya escribe markdown** y quiere orden, o alguien a quien **hay que ahorrarle la
  sintaxis**? La paleta existe por el segundo, el árbol y las pestañas por el primero.
- ¿Notas personales, documentación técnica, escritura larga, apuntes de estudio? Cada uno pide
  features distintas y algunas se estorban.
- ¿Uso individual definitivo, o «individual por ahora»? Si la respuesta es la segunda, hay decisiones
  de modelo de datos que conviene no cerrar más de lo que ya están.

## P2 — ¿Contra qué compite y por qué elegiría alguien esto?

Obsidian, Notion, HackMD, Bear, Joplin, Logseq y VS Code no aparecen mencionados **ni una vez** en el
repositorio. La pregunta que importa no es «qué hacen ellos» sino:

> ¿Cuál es la única frase por la que alguien elegiría One Markdown teniendo esas opciones gratis?

Candidatas que se deducen de lo construido, sin que nadie las haya elegido todavía:
**«markdown para quien no sabe markdown»** · **«accesible de verdad, no de mentira»** ·
**«tus notas en el navegador, privadas y sin instalar nada»**. La segunda es la única que hoy está
respaldada por trabajo real y difícil de copiar.

## P3 — ¿Cómo llega a alguien?

Sin despliegue, no hay producto: hoy la aplicación no existe fuera de una máquina. Hay que decidir
**dónde vive** (y quién paga el hosting, la base de datos y Redis), **si hay registro abierto o por
invitación**, y **si hay landing** o el registro es la puerta.

Ligado: elegir proveedor de correo. Es una decisión pequeña que desbloquea muchas cosas.

## P4 — ¿Cuál es la siguiente apuesta, y cuál es la que se descarta?

Las cuatro decisiones concretas encima de la mesa, todas con su coste en
[`04-huecos-y-candidatos.md`](04-huecos-y-candidatos.md):

1. **Búsqueda** — el hueco más grande con uso real.
2. **Compartir un enlace de solo lectura** — el primer escalón hacia otro producto. ¿Se sube o no?
3. **Papelera / versiones** — cuánta red de seguridad merece el borrado definitivo.
4. **Pulido de lo que ya existe** (scroll sincronizado, exportar, pestañas persistentes, drag & drop)
   frente a alcance nuevo.

**Y la pregunta incómoda que las envuelve**: ¿hay algo de lo ya construido que sobre? Las siete specs
salieron del brief inicial, no de haber visto a nadie usar la herramienta.

## P5 — ¿Qué significaría que va bien?

No hay ni una métrica ni un objetivo escrito. Aunque solo la uses tú, hace falta un criterio para
saber si una feature acertó: ¿documentos creados? ¿días seguidos de uso? ¿que dejes de usar otra
herramienta? Sin algo así, cada decisión siguiente se vuelve a tomar desde cero.

---

### Cómo usar esta lista en Cowork

Están en orden de dependencia: **P0 → P1 → P2 → P3 → P4**, y P5 se puede responder en cuanto haya
respuesta a P0. Responder P0 y P1 con dos párrafos honestos vale más que un plan de diez features, y
convierte el resto del paquete en algo accionable.
