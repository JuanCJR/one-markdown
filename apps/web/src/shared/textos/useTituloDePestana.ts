import { useEffect } from 'react';

import { NOMBRE_APP, tituloDePestana } from './textos';

/**
 * Pone el título de la pestaña del navegador: «Fermentos · One Markdown».
 *
 * **Por qué hace falta un sitio para esto.** Hasta la fase 6, `index.html` fijaba «One Markdown» y
 * ahí se quedaba: con seis pestañas abiertas del mismo producto, las seis se llamaban igual y no
 * había forma de volver a la que uno buscaba sin entrar en todas. El nombre de la aplicación pasa a
 * la marca de la cabecera y a **la cola** del título; la cabeza es el documento, porque una pestaña
 * estrecha recorta por la derecha.
 *
 * Se restaura al desmontar. Sin eso, salir del editor a la lista dejaría en la pestaña el nombre de
 * un documento que ya no está abierto, que es peor que no decir nada.
 */
export function useTituloDePestana(documento?: string | null): void {
  useEffect(() => {
    document.title = tituloDePestana(documento);

    return () => {
      document.title = NOMBRE_APP;
    };
  }, [documento]);
}
