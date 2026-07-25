// Fixture de lint — NO es código de producción y NO entra en ningún tsconfig de build.
// Existe para verificar el AC-13 de la spec 000: `pnpm exec eslint` debe FALLAR sobre este archivo.
// Si algún día este archivo pasa el lint, la regla `@typescript-eslint/no-explicit-any` se aflojó.
export function parse(payload: any): any {
  return payload;
}
