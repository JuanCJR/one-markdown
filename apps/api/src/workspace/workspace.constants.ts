/**
 * Constantes de dominio del workspace (`plan.md` §3 de la spec 002).
 *
 * Van como constantes con nombre y **no** como variables de entorno: son decisiones de producto de la
 * spec, no configuración de despliegue. Cambiarlas es cambiar la spec, y por tanto un cambio versionado.
 *
 * Este archivo no importa nada: lo consumen tanto el dominio puro como los DTO y los servicios.
 */

/**
 * Longitud máxima del nombre de un directorio, en unidades UTF-16 (lo mismo que cuenta `@MaxLength`).
 *
 * Cabe en la barra lateral con una sangría razonable y en un `breadcrumb`; por encima de esto, el
 * nombre no es un nombre, es una descripción.
 */
export const MAX_DIRECTORY_NAME_LENGTH = 120;

/**
 * Longitud máxima del título de un documento. Admite una frase entera y sigue siendo una sola línea.
 */
export const MAX_DOCUMENT_TITLE_LENGTH = 200;

/**
 * Número de niveles de directorios permitidos: profundidades válidas `0`…`9`, donde `depth` es el
 * número de ancestros. Acota el recorrido de ancestros, la sangría de la UI y el coste de cualquier
 * comprobación estructural.
 */
export const MAX_DIRECTORY_DEPTH = 10;

/**
 * Tamaño máximo del markdown de un documento, en **caracteres**: es lo que cuenta `@MaxLength` y lo que
 * el cliente puede comprobar con el mismo criterio. Unas 60.000 palabras.
 */
export const MAX_DOCUMENT_CONTENT_CHARS = 200_000;

/**
 * Directorios + documentos por usuario. Es el tope que hace sostenible servir el árbol completo y plano
 * en una sola respuesta (decisión 4 del plan).
 */
export const MAX_WORKSPACE_NODES = 5_000;

/**
 * Techo del cuerpo JSON de **toda** la API (riesgo #7 de la spec).
 *
 * El valor por defecto de Express es 100 kB, así que un documento legítimo de `200.000` caracteres se
 * rechazaría por tamaño **antes** de que el DTO llegara a verlo: el cliente recibiría un error de
 * transporte en lugar del `400`/`201` que dice el contrato. Se deja en más de cuatro veces el contenido
 * máximo para dejar sitio al multibyte (una `ñ` son dos bytes, un emoji cuatro) y al escapado de JSON.
 *
 * Vive aquí, junto al límite que lo motiva, para que quien suba `MAX_DOCUMENT_CONTENT_CHARS` vea en la
 * línea de al lado que también tiene que revisar esto. Es global, y por tanto aplica también a los
 * endpoints de auth: inofensivo, porque sus DTO acotan cada campo por separado.
 */
export const JSON_BODY_LIMIT = '2mb';
