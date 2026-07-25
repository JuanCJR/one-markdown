/**
 * Nombre del esquema de seguridad Bearer en el documento OpenAPI (AC-21).
 *
 * Es una constante y no el literal `'bearer'` repetido porque el nombre tiene que coincidir en dos
 * sitios muy separados: el `addBearerAuth(..., 'bearer')` de `bootstrap.ts` y cada
 * `@ApiBearerAuth('bearer')` de los controladores. Si divergen, el documento sigue siendo válido pero
 * los endpoints referencian un esquema inexistente y nadie puede autenticarse desde la UI.
 */
export const AUTH_BEARER_SCHEME = 'bearer';
