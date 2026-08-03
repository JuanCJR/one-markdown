# 5. Restricciones que condicionan cualquier decisión

Lo que hay que tener delante al proponer trabajo, para no proponer lo que este proyecto no puede
absorber.

## Cómo se construye aquí

El proyecto trabaja con **SDD + TDD estrictos**, y no de forma nominal:

- **Nada se implementa sin spec**: una carpeta por feature con `spec.md` (qué y por qué), `plan.md`
  (cómo), `tasks.md` (tareas atómicas) y `CHANGELOG.md`. La spec se versiona semánticamente.
- **Cada criterio de aceptación tiene al menos un test automatizado**, y el test se escribe antes de
  la implementación y debe fallar primero.
- **Nada se marca como hecho sin haber corrido el comando y visto su salida real.**

**Consecuencia de producto, y es la importante: una feature aquí cuesta bastante más que en un
proyecto normal, y a cambio lo que está hecho está de verdad hecho.** Proponer «cinco mejoras
pequeñas» no es barato: son cinco specs. Proponer una feature bien acotada con su razón escrita es lo
que este proceso convierte en trabajo eficiente.

Referencias: `CLAUDE.md`, `specs/README.md`, y la retrospectiva de método en `docs/retrospectivas/`.

## Capacidad

- **Una persona desarrollando**, con agentes. Siete specs cerradas entre el 2026-07-24 y el
  2026-08-01.
- Las tres últimas specs **no tocaron backend en absoluto**. El frontend es hoy donde está el trabajo
  y donde más rinde.

## Técnicas y de entorno

| Restricción | Qué implica para producto |
|---|---|
| **No hay proveedor de correo** | Bloquea recuperación de contraseña, verificación de correo, invitaciones, notificaciones y cualquier cosa que dependa de escribir a alguien. **Es la restricción que más features bloquea de una sola vez** |
| **No hay entorno desplegado**: sin dominio, TLS, observabilidad ni backups | Fuera de alcance desde la spec `000` y todavía sin decidir. Nada llega a un usuario real hasta que se resuelva |
| **No hay almacenamiento de archivos** | Bloquea subir imágenes y adjuntos |
| **Interfaz solo en español**, sin i18n | Abrirse a otro idioma es trabajo transversal a todas las pantallas |
| **Diseño no responsive** | Cualquier plan que suponga uso en móvil incluye rehacer la disposición |
| **Suite de navegador solo Chromium** | Lo que solo se puede comprobar en Firefox o Safari queda sin cubrir, y está declarado como tal |
| **Los tests no pueden verificar lectores de pantalla reales** | Hay tres revisiones manuales pendientes, escritas como pendientes en vez de fingidas con un test |
| **Base de datos y Redis corren en Docker local** | En esta máquina el CLI es `docker.exe` (WSL) y hay que arrancar Docker Desktop antes |

## Límites del producto que ya están en el código

Profundidad de carpetas **10** · **5.000** nodos por usuario · documento de **200.000** caracteres ·
título 200 caracteres · nombre de carpeta 120 · cuerpo HTTP 2 MB. Y los límites de abuso: 5 altas por
IP cada 15 min, 10 logins por minuto, 120 peticiones de workspace por minuto, bloqueo de cuenta a los
5 fallos durante 15 minutos.

**Ninguno de estos números salió de medir uso real** — no hay uso real. Son cotas defensivas
razonables, y son revisables en cuanto haya datos.

## Reglas duras que ninguna decisión de producto puede saltarse

Están en `CLAUDE.md` y valen para todo lo que se proponga:

1. **Todo acceso a documentos y directorios se filtra por el usuario del token.** Sin excepciones.
2. **El preview de markdown va siempre sanitizado.**
3. **Los secretos solo por variables de entorno**, validadas al arrancar. Nada en el repositorio.
4. **TypeScript estricto** en todos los paquetes.
