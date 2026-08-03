# Retrospectivas de método

Aquí no se revisa **qué** se construyó, sino **cómo** se trabajó: subagentes, skills, SDD, TDD,
seguimiento y las herramientas que los sostienen. El estado del producto vive en
[`../producto/`](../producto/README.md) y el técnico en `specs/**` e `IMPLEMENTATION.md`.

## Índice

| Fecha | Alcance | Qué salió de ella |
|---|---|---|
| [2026-08-01](2026-08-01-metodologia.md) | Las siete primeras specs (`000`…`006`) | Las cuatro skills de método, los dos hooks de medición, la poda del seguimiento y la causa real del desplome de subagentes |

## Cómo se hace la siguiente

Lo que hizo útil a la primera, y conviene repetir:

1. **Todo dato sale del repositorio, no de la impresión que quedó.** Cada afirmación lleva el comando
   con el que se vuelve a comprobar. Las que no lo llevaban resultaron ser las falsas.
2. **Se mide antes de opinar.** Tareas por subagente y por fase, versiones de spec, patches escritos
   con el código delante, tamaño de los documentos. La forma de las cifras dice más que el recuerdo.
3. **Se valida el instrumento antes de creerse la medida.** La primera retrospectiva concluyó que las
   skills no se usaban a partir de un contador que valía cero **porque estaban apagadas**. Un cero de
   un instrumento desconectado es indistinguible de uno real, y ese error se coló dentro del propio
   documento que lo perseguía.
4. **Se separa aplicar de verificar.** Una mejora escrita no es una mejora demostrada: la prueba llega
   con la siguiente feature, y hasta entonces se declara pendiente en vez de darla por cerrada.
5. **El diagnóstico equivocado no se borra: se anota al lado del bueno.** Es lo que impide repetirlo.

## Qué medir la próxima vez, y con qué

La reforma del 2026-08-03 dejó instrumentos que la primera retrospectiva no tuvo. La siguiente empieza
por leerlos:

```bash
# skills realmente invocadas, por agente
python3 -c "import json,collections;print(collections.Counter((json.loads(l)['skill'],json.loads(l)['agent']) for l in open('.claude/skill-usage.jsonl')))"

# quién escribió el código de producción: subagentes o agente principal
python3 -c "import json,collections;print(collections.Counter(json.loads(l)['agent'] for l in open('.claude/delegation.jsonl')))"

# tamaño de los documentos vivos: no deben crecer
wc -l IMPLEMENTATION.md specs/README.md
```

Y las tres preguntas que quedaron abiertas y solo la práctica puede responder:

- **¿Volvieron los subagentes?** `delegation.jsonl` lo dice sin discusión. Si sale `main`, la sesión
  corría en segundo plano y nadie pidió la delegación explícitamente.
- **¿Qué skills se usan de verdad?** Con datos propios ya se puede podar; sin ellos, no.
- **¿Se sostiene el método fuera de los agentes?** Es la primera vez que vive en skills que hay que
  cargar. Si alguna vez no está disponible, el agente debe **parar y avisar**: que eso ocurra —y se
  vea— es la prueba de que el montaje funciona.
