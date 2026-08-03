# One Markdown

Gestor de markdown con árbol de categorías/directorios, editor texto/preview, paleta de elementos markdown, tabs y split view.

## Quién hace qué

Cualquier cambio significativo entra por `orchestrator`, dueño de los documentos de
especificación y del de seguimiento. Nadie más los edita. Quien implementa solo ejecuta tareas ya
especificadas, en TDD.

| Rol | Territorio |
|---|---|
| `frontend` | apps/web/**, packages/shared/** |
| `backend` | apps/api/**, packages/shared/** |


## El método

**El método vive en las skills, no en este archivo.** Aquí solo está dónde aplica.

| Skill | Qué posee |
|---|---|
| `spec-driven-development` | Nada se implementa sin especificación versionada. |
| `test-driven-development-tdd` | RED → GREEN → REFACTOR, la regla del andamio y el radio de un cambio. |
| `stop-and-report` | Cuándo se para y se avisa en vez de arreglarlo por cuenta propia. |
| `verification-and-measurement` | Cómo se verifica, y cómo no creerse un cero falso. |

**Si una de las cuatro no está disponible, se para y se avisa** — no se reconstruye de memoria.


Lo único de metodología que es de este repositorio y no de las skills: El seguimiento se actualiza **solo tras verificar** (comando corrido + salida real), con `[ ]` pendiente · `[~]` en curso o bloqueado con motivo · `[x]` hecho y verificado. El detalle histórico de cada feature va a su CHANGELOG, no ahí.


## Reglas de código

- TypeScript estricto en todos los paquetes.
- **Autorización por recurso**: todo acceso a documentos/directorios se filtra por el `userId` del token.
- El backend es el dueño del auth (JWT access+refresh, bcrypt, MFA TOTP, Passport, Redis). Auth.js está fuera de alcance.
- Preview de markdown siempre **sanitizado**.
- Secretos solo por variables de entorno validadas al arrancar; nada en el repo.



> Este archivo lo **genera** `showi sync` desde `showi.yml`. Editarlo a mano se pierde en el próximo
> `sync`, y `showi check` lo detecta antes.

# Cómo se trabaja aquí

Cuatro reglas gobiernan todo lo que se escribe en este repositorio. **No están definidas en este
documento**: cada una vive en una skill, y este documento solo dice cuáles son y cuándo se cargan.

| Skill | Cuándo se carga |
|---|---|
| `spec-driven-development` | Antes de planificar cualquier cambio significativo, y al escribir o revisar una especificación. |
| `test-driven-development-tdd` | Antes de la primera línea de cualquier implementación o corrección. |
| `stop-and-report` | Al recibir una tarea, y otra vez en cuanto algo no cuadre con lo que la tarea predecía. |
| `verification-and-measurement` | Antes de dar por buena cualquier cifra, cualquier verde y sobre todo cualquier cero. |

**Si una de las cuatro no está disponible, se para y se avisa antes de empezar.** No se reconstruye de
memoria: un método a medias produce el mismo verde y ninguna señal, que es exactamente el fallo
silencioso contra el que existe todo esto.

## Lo que no se negocia

**Nada se implementa sin especificación.** Código sin spec es adivinar qué se quería.

**El test va primero, y hay que verlo fallar por la razón correcta.** Un test que nunca estuvo en
rojo no ha demostrado nada. Si la tarea estrena un módulo, se crea antes el andamio —la firma con
cuerpo vacío—: un fallo de importación solo demuestra que el archivo no está.

**Solo se tocan los archivos que la tarea enumera.** Si hace falta otro, se para y se avisa. Ampliar
la lista sobre la marcha es cómo un radio de cambio mal calculado llega a producción.

**Un comando de verificación tiene que ejecutar algo.** Un comando que no corre nada sale en verde, y
ésa es su trampa. Se corre antes de escribirlo en la tarea.

**No se debilita una aserción para que pase.** Gana el criterio hasta que quien escribió la spec
decida otra cosa.

**Se reporta la salida real, no un resumen de la salida real.**

## Lo que se dice en voz alta

Un desvío callado cuesta más que el desvío. Se escribe, aunque sea pequeño y aunque haya salido bien:
un artefacto tocado que la tarea no enumeraba, un criterio que resultó inalcanzable, un rojo que no
era el predicho, una medida que hubo que rehacer porque el instrumento estaba mal.

Lo que ningún test de este repositorio puede cubrir **se declara como tal**, y no se escribe un test
que finja lo contrario. Una revisión manual declarada es honesta; un test que la simula es un verde
falso permanente.
