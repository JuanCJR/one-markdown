import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, type TransformFnParams } from 'class-transformer';
import { IsBoolean } from 'class-validator';

/**
 * Convierte **solo** `'true'` y `'false'` en booleanos; cualquier otra cosa pasa tal cual para que
 * `@IsBoolean` la rechace con un `400`.
 *
 * Es estricto a propósito. La conversión laxa de siempre —`value === 'true'`— convierte
 * `?recursive=yes`, `?recursive=1` y hasta `?recursive=verdadero` en `false`, es decir: el usuario
 * pide un borrado recursivo con una errata y la API le contesta un `409` que no entiende. Aquí un
 * valor que no es ninguno de los dos es un error de la petición y se dice.
 *
 * `enableImplicitConversion` está desactivado en el `ValidationPipe` global, así que sin este
 * `@Transform` la query llegaría como cadena y `@IsBoolean` rechazaría **también** el `'true'`
 * legítimo.
 */
export function toStrictBoolean({ value }: TransformFnParams): unknown {
  if (value === 'true') {
    return true;
  }

  if (value === 'false' || value === undefined) {
    return false;
  }

  return value;
}

/**
 * Query string de `DELETE /api/workspace/directories/:id` (plan §4 de la spec 002).
 *
 * Sin el parámetro, `recursive` vale `false`: el borrado destructivo nunca es el comportamiento por
 * defecto. Un directorio con hijos responde `409 DIRECTORY_NOT_EMPTY` y el cliente tiene que
 * confirmarlo explícitamente, que es el freno contra el accidente (decisión 6 del plan: no hay
 * papelera, así que el borrado es definitivo).
 */
export class DeleteDirectoryQueryDto {
  @ApiPropertyOptional({
    type: Boolean,
    default: false,
    example: false,
    description:
      'Con `true` borra el directorio con todo su subárbol y sus documentos. Solo se aceptan los literales `true` y `false`.',
  })
  @Transform(toStrictBoolean)
  @IsBoolean({ message: 'recursive solo admite los valores true o false' })
  readonly recursive: boolean = false;
}
