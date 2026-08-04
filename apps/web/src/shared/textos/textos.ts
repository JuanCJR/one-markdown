/**
 * Todo el texto que la persona lee u oye, en un sitio.
 *
 * **Por qué existe este módulo.** La fase 0 inventarió el microcopy repartido por 26 archivos, con
 * tres cadenas duplicadas literalmente en dos sitios cada una (`docs/design/00-auditoria.md` §4.14).
 * Una voz no se mantiene repartida: se corrige en un archivo y sigue siendo la vieja en el otro, y
 * nadie lo nota porque las dos pantallas no se miran a la vez. Aquí la cadena existe **una vez** y
 * quien la pinta la importa.
 *
 * **Qué no vive aquí, y no es un olvido:**
 *
 * - Los marcadores de `markdown-palette.ts` —`texto en negrita`, `Celda`, la plantilla de tabla—.
 *   No son interfaz: acaban **dentro del documento de la persona**, son contrato de producto y
 *   tienen su propio test que los afirma enteros. Moverlos aquí los convertiría en copy.
 * - Los mensajes de dominio del servidor. El cliente los mapea por código (§4.6), y lo que no tiene
 *   mapa se reenvía: inventar aquí una traducción para un código que todavía no existe sería
 *   adivinar qué dirá el backend.
 *
 * **Las reglas de voz que este archivo hace verdad** están en `docs/design/06-marca.md` §4, y el
 * guard que impide reintroducir el léxico prohibido, en `src/design/voz-guard.test.ts`.
 */

/** El nombre de la aplicación. No es un `h1` de ninguna pantalla: vive en la marca y en la pestaña. */
export const NOMBRE_APP = 'One Markdown';

/** El descriptor del bloqueo vertical. Va en versalitas y nunca dentro de una frase. */
export const DESCRIPTOR_APP = 'Tu archivo privado';

/**
 * El título de la pestaña del navegador: primero el documento, después la aplicación.
 *
 * Ese orden y no el contrario porque una pestaña estrecha recorta por la derecha, y lo que hay que
 * poder leer con 12 caracteres visibles es qué documento es, no en qué aplicación está.
 */
export function tituloDePestana(documento?: string | null): string {
  return documento === undefined || documento === null || documento.trim() === ''
    ? NOMBRE_APP
    : `${documento} · ${NOMBRE_APP}`;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.1 · Shell y navegación
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const SHELL = {
  /** Nombre accesible del `<nav>`. La palabra del sistema para el árbol es «estructura». */
  navegacion: 'Estructura',
  mostrarEstructura: 'Mostrar la estructura',
  ocultarEstructura: 'Ocultar la estructura',
  /** El enlace y su destino se llaman igual: quien lo pulsa aterriza en el mismo rótulo. */
  seguridad: 'Seguridad de la cuenta',
  cerrarSesion: 'Cerrar sesión',
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.2 · Entrar
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const ENTRAR = {
  titulo: 'Entrar en tu archivo',
  correo: 'Correo electrónico',
  contrasena: 'Contraseña',
  enviar: 'Entrar',
  pie: '¿Todavía no tienes archivo?',
  crear: 'Crear el tuyo',
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.3 · Código de verificación al entrar
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const CODIGO = {
  ayuda:
    'Tu cuenta pide un código además de la contraseña. Abre tu app de autenticación y escribe el que muestra ahora.',
  etiqueta: 'Código de verificación',
  /**
   * Una sola vez, y es la razón de este módulo en pequeño: la fase 0 la encontró copiada en
   * `MfaChallengeForm.tsx` y en `SecurityPage.tsx`.
   */
  formato: '6 dígitos, o uno de tus códigos de recuperación.',
  verificar: 'Verificar',
  otroCorreo: 'Empezar con otro correo',
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.4 · Crear la cuenta
   ─────────────────────────────────────────────────────────────────────────────────────────── */

/** Longitud mínima de la contraseña. Espeja la de `RegisterRequestDto`; la autoridad es el servidor. */
export const MINIMO_CONTRASENA = 12;

export const CREAR_CUENTA = {
  titulo: 'Crear tu archivo',
  enviar: 'Crear el archivo',
  correo: 'Correo electrónico',
  contrasena: 'Contraseña',
  nombre: 'Nombre (opcional, solo lo ves tú)',
  ayudaContrasena: '12 caracteres o más, con una letra y un número.',
  pie: '¿Ya tienes cuenta?',
  entrar: 'Entrar',
} as const;

/**
 * Qué le falta a esta contraseña, un problema por fallo y **con la cifra**.
 *
 * Sustituye a la única cadena que la fase 0 usaba a la vez como ayuda y como error («No cumple las
 * reglas indicadas»). Decir la regla otra vez no es decir qué pasa: quien escribió once caracteres
 * necesita saber que le falta **uno**, y contarlos a mano en un campo de contraseña es imposible
 * porque los puntos no se cuentan.
 *
 * Devuelve la lista vacía cuando la contraseña vale, que es también cómo se pregunta si vale.
 */
export function problemasDeContrasena(contrasena: string): readonly string[] {
  const problemas: string[] = [];
  const faltan = MINIMO_CONTRASENA - contrasena.length;

  if (faltan > 0) {
    problemas.push(
      faltan === 1 ? 'Te falta 1 carácter.' : `Te faltan ${String(faltan)} caracteres.`,
    );
  }

  if (!/[A-Za-z]/.test(contrasena)) {
    problemas.push('Añade una letra.');
  }

  if (!/\d/.test(contrasena)) {
    problemas.push('Añade un número.');
  }

  return problemas;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.5 · Seguridad de la cuenta
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const SEGURIDAD = {
  titulo: 'Seguridad de la cuenta',
  /**
   * Sin dos puntos: la palabra va pegada al sujeto porque el estado se dice en masa de tinta, no en
   * color, y «Verificación en dos pasos: activada» leído de corrido suena a etiqueta de formulario.
   */
  estadoActivada: 'Verificación en dos pasos, activada',
  estadoDesactivada: 'Verificación en dos pasos, desactivada',
  seccion: 'Verificación en dos pasos',
  invitacion:
    'Al entrar, tu cuenta pedirá también un código de tu app de autenticación (Google Authenticator, 1Password, Aegis).',
  activar: 'Activar verificación en dos pasos',
  escanea: 'Escanea el código',
  /** `alt` del QR: dice **qué es**, no qué hacer con él. Lo que hay que hacer ya está escrito al lado. */
  altQr: 'Código QR con la clave de esta cuenta',
  claveManual: 'Si no puedes escanearlo, escribe esta clave en tu app:',
  ayudaCodigo: 'Los 6 dígitos que muestra tu app ahora mismo.',
  confirmar: 'Confirmar el código',
  codigos: 'Códigos de recuperación',
  avisoCodigos:
    'Cópialos ahora: esta pantalla no vuelve. Cada código entra una sola vez, y sirve si pierdes el teléfono.',
  desactivarSeccion: 'Desactivar la verificación',
  desactivarAviso:
    'Desactivarla borra tu clave y tus códigos de recuperación, y cierra las sesiones abiertas en tus otros dispositivos.',
  desactivar: 'Desactivar verificación en dos pasos',
  volver: 'Volver a tus documentos',
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.6 · Errores al entrar
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const ERRORES = {
  /**
   * El fallo que no sabemos nombrar. Dice tres cosas y ninguna es «error»: quién paró, qué pasa con
   * el texto de la persona, y qué hacer. Lo que no se sabe —por qué— se dice en vez de disfrazarse.
   */
  desconocido:
    'One Markdown ha parado esta acción y no sabe por qué. Tu texto sigue donde estaba. Vuelve a intentarlo.',
  sinServidor: 'El servidor no responde. Revisa tu conexión y vuelve a intentarlo.',
  credenciales: 'El correo o la contraseña no coinciden.',
  /**
   * Límite por IP, que **no** es el bloqueo de una cuenta: aquí no ha fallado ninguna contraseña, y
   * decirle a alguien que ha fallado la suya cuando no lo ha hecho es asustar por nada.
   */
  demasiadasPeticiones:
    'Esta red ha hecho demasiadas peticiones. Vuelve a intentarlo dentro de un minuto.',
  /**
   * Los dos incumplimientos de contrato del login —segundo factor sin token, y ni sesión ni segundo
   * factor— dicen a la persona **la misma frase**, porque desde donde ella está son el mismo hecho:
   * el inicio de sesión no terminó. El detalle técnico va al log, que es de quien lo tiene que
   * arreglar (§4.6 de la fase 6).
   */
  sesionAMedias:
    'El inicio de sesión se ha quedado a medias. Escribe otra vez tu correo y tu contraseña.',
  desafioCaducado:
    'El paso del código ha caducado. Empieza otra vez con tu correo y tu contraseña.',
  /** Sin puntos suspensivos: no es una frase inacabada, es lo que está pasando. */
  comprobandoSesion: 'Comprobando tu sesión',
} as const;

/**
 * Los dos detalles técnicos que **no** se enseñan. Se exportan para que el store los escriba en el
 * log con un nombre, en vez de perderlos al sustituirlos por la frase de la persona.
 */
export const DETALLE_TECNICO = {
  mfaSinToken: 'La API pidió segundo factor sin entregar un token.',
  sinSesionNiMfa: 'La API no devolvió sesión ni pidió segundo factor.',
} as const;

/** «40 segundos» · «1 minuto» · «4 minutos». La unidad se elige por el valor, no por costumbre. */
export function esperaEnPalabras(segundos: number): string {
  if (segundos < 60) {
    return `${String(Math.max(1, Math.ceil(segundos)))} segundos`;
  }

  const minutos = Math.ceil(segundos / 60);

  return minutos === 1 ? '1 minuto' : `${String(minutos)} minutos`;
}

/**
 * Cuenta bloqueada por intentos fallidos.
 *
 * **«Nadie ha entrado» es la mitad del mensaje.** Quien ve un bloqueo en su propia cuenta tiene dos
 * miedos, y el segundo —que alguien esté dentro— es el que no se atendía: la cadena de la fase 0
 * («Demasiados intentos. Vuelve a probar en 4 minutos.») lo dejaba abierto. El bloqueo es
 * exactamente la prueba de que **no** se ha entrado, así que se dice.
 *
 * El recuento de intentos está pedido y **no llega**: el `429` de `AccountLockedException` trae
 * `retryAfterSeconds` y nada más. Mientras el contrato no lo traiga, esta es la única forma
 * producible, y es la que la fase 6 previó para ese caso. Ver `docs/design/06-marca.md` §7.
 */
export function cuentaBloqueada(segundos: number): string {
  return `Demasiados intentos seguidos. Esta cuenta acepta el siguiente dentro de ${esperaEnPalabras(segundos)}. Nadie ha entrado.`;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.7 · Estructura
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const ESTRUCTURA = {
  /** Nombre accesible del `role="tree"`. La misma palabra que el `<nav>` que lo contiene. */
  arbol: 'Estructura',
  cargando: 'Cargando la estructura',
  /** El vacío dice **dónde** va lo primero, no que no haya nada: eso ya se ve. */
  vacio: 'Tu archivo está vacío. El primer documento va en la raíz.',
  nuevoEnRaiz: 'Nuevo en la raíz',
} as const;

export const accionesDeFila = {
  nuevoEn: (nombre: string): string => `Nuevo en «${nombre}»`,
  renombrar: (nombre: string): string => `Renombrar «${nombre}»`,
  mover: (nombre: string): string => `Mover «${nombre}»`,
  borrar: (nombre: string): string => `Borrar «${nombre}»`,
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.8 · Diálogos de la estructura
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const DIALOGOS = {
  cancelar: 'Cancelar',

  crear: {
    tituloRaiz: 'Nuevo en la raíz',
    tituloEn: (padre: string): string => `Nuevo en «${padre}»`,
    tipo: 'Tipo',
    /** «Carpeta» y no «Directorio»: la persona a la que servimos guarda cosas en carpetas. */
    carpeta: 'Carpeta',
    documento: 'Documento',
    /** El botón dice qué se va a crear, para que no haya que mirar arriba antes de pulsarlo. */
    enviarCarpeta: 'Crear la carpeta',
    enviarDocumento: 'Crear el documento',
  },

  renombrar: {
    titulo: (nombre: string): string => `Renombrar «${nombre}»`,
    enviar: 'Guardar el nombre',
  },

  mover: {
    titulo: (nombre: string): string => `Mover «${nombre}»`,
    destino: 'Destino',
    raiz: 'Raíz',
    enviar: 'Mover ahí',
  },

  borrar: {
    tituloDocumento: (nombre: string): string => `Borrar «${nombre}»`,
    cuerpoDocumento: 'Este documento se borra ahora y no vuelve.',
    enviarDocumento: 'Borrar el documento',

    /**
     * Una carpeta vacía **no** es ninguno de los dos casos que enumera la fase 6 (§4.8 escribe el
     * documento y la carpeta con cosas dentro, y no esta). Se redacta aquí con la forma del caso del
     * documento y el sustantivo que toca, y queda registrado como añadido en `06-marca.md` §7: no se
     * pide el campo de confirmación porque no hay nada dentro que perder, y sin él el diálogo dejaría
     * de decir qué se borra.
     */
    tituloCarpetaVacia: (nombre: string): string => `Borrar «${nombre}»`,
    cuerpoCarpetaVacia: 'Esta carpeta está vacía y se borra ahora. No vuelve.',
    enviarCarpetaVacia: 'Borrar la carpeta',

    /** El título ya avisa de lo que la fase 0 escondía en la tercera línea: se va lo de dentro. */
    tituloCarpeta: (nombre: string): string => `Borrar «${nombre}» y lo que hay dentro`,
    confirmacion: 'Escribe borrar para confirmarlo.',
    /** Lo que hay que teclear. En minúsculas y sin acento: se compara normalizado. */
    palabraConfirmacion: 'borrar',
    enviarCarpeta: (total: number): string => `Borrar ${String(total)} elementos`,
  },

  /** Nombre del campo: un directorio tiene nombre; un documento, título. */
  etiquetaNombre: (esCarpeta: boolean): string => (esCarpeta ? 'Nombre' : 'Título'),
} as const;

/**
 * Qué hay dentro de la carpeta que se va a borrar, y **cuántos se borran en total**.
 *
 * Los dos números son distintos y los dos importan: dentro hay 12, pero se borran 13, porque la
 * carpeta también cae. La cadena de la fase 0 solo decía el 12 y dejaba el 13 sin escribir en
 * ningún sitio — la persona sumaba, o no sumaba.
 *
 * Con un solo elemento dentro se nombra su tipo en vez de contarlo: «Dentro hay 1 documento».
 */
export function contenidoDeCarpeta(carpetas: number, documentos: number): string {
  const dentro = carpetas + documentos;
  const total = dentro + 1;
  const cierre = `Se borran los ${String(total)} y no vuelven.`;

  if (dentro === 1) {
    return `Dentro hay ${carpetas === 1 ? '1 carpeta' : '1 documento'}. ${cierre}`;
  }

  const partes = [
    carpetas === 0 ? null : carpetas === 1 ? '1 carpeta' : `${String(carpetas)} carpetas`,
    documentos === 0 ? null : documentos === 1 ? '1 documento' : `${String(documentos)} documentos`,
  ].filter((parte): parte is string => parte !== null);

  return `Dentro hay ${String(dentro)} elementos: ${partes.join(' y ')}. ${cierre}`;
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.9 · Editor
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const EDITOR = {
  cargando: 'Cargando el documento',
  cargandoRegion: 'Carga del documento',
  /** El «ya no existe» dice **cómo** ha podido pasar: si no, parece que lo ha perdido el programa. */
  desaparecido: 'Este documento ya no existe. Lo borraste en otra pestaña o en otro dispositivo.',
  volverAEstructura: 'Volver a la estructura',
  ruta: 'Ruta del documento',
  modoDeVista: 'Modo de vista',
  /**
   * Los dos paneles se llaman igual en el sistema y en la interfaz: **texto** y **vista**. «Vista
   * previa» sobraba una palabra y prometía un paso intermedio que no existe — no hay nada después.
   */
  modoTexto: 'Texto',
  modoVista: 'Vista',
  modoDividida: 'Dividida',
  /**
   * Nombre accesible del área de escritura. **No dice «markdown»**: la persona a la que servimos no
   * sabe que esto es markdown, y el nombre del campo donde escribe no es el sitio para enseñárselo.
   */
  areaDeTexto: (titulo: string): string => `Texto de «${titulo}»`,
  guardar: 'Guardar',
  regionGuardado: 'Estado del guardado',
  resolverConflicto: 'Resolver el conflicto',
  deshacer: 'Deshacer',
  rehacer: 'Rehacer',
  atajoDeshacer: 'Ctrl+Z',
  atajoRehacer: 'Ctrl+Shift+Z',
  quedan: (n: number): string => `Quedan ${n.toLocaleString('es-ES')} caracteres`,
  /** El exceso dice la **consecuencia**, que es lo que la cifra sola no decía: no se guarda. */
  sobran: (n: number): string =>
    `Te sobran ${n.toLocaleString('es-ES')} caracteres: el documento no se guarda hasta que quepan.`,
  sinServidor:
    'El servidor no responde. Tu texto sigue aquí y se guardará cuando vuelvas a escribir.',
} as const;

export const SIN_DOCUMENTO = {
  titulo: 'Ningún documento abierto.',
  abrirUltimo: 'Abrir el último que escribiste',
  elegirEnEstructura: 'Elegir uno en la estructura',
} as const;

export const NO_ENCONTRADO = {
  /** Sin el número y sin la raya: `404` no es información para quien no escribió el servidor. */
  titulo: 'Esta dirección no está en tu archivo.',
  volver: 'Volver a tus documentos',
} as const;

/**
 * Los **seis** estados del guardado con **seis** frases.
 *
 * La fase 0 tenía cuatro rótulos para seis estados: los tres fallos compartían «Sin guardar», y la
 * región educada decía lo mismo tanto si el servidor no contestaba como si el documento había
 * cambiado por debajo. Quien la oye por un lector de pantalla no tiene el aviso de al lado delante:
 * la región **es** todo lo que recibe, y tres cosas distintas anunciadas igual son una sola cosa.
 *
 * `hora` solo se usa en `clean`, y es la hora del último guardado confirmado. Sin ella —el estado
 * limpio de un documento recién abierto, que no se ha guardado en esta sesión— la frase es
 * «Guardado» a secas: inventarle una hora sería decir que pasó algo que no pasó.
 */
export function estadoDeGuardado(
  estado: 'clean' | 'dirty' | 'saving' | 'unreachable' | 'conflict' | 'rejected',
  hora: string | null = null,
): string {
  switch (estado) {
    case 'clean':
      return hora === null ? 'Guardado' : `Guardado ${hora}`;
    case 'dirty':
      return 'Sin guardar';
    case 'saving':
      return 'Guardando';
    case 'unreachable':
      return 'Sin guardar: el servidor no responde';
    case 'conflict':
      return 'Sin guardar: el documento cambió fuera';
    case 'rejected':
      return 'Sin guardar: el texto pasa del límite';
  }
}

/** La hora de un guardado, en el formato de la región viva: 24 h, sin segundos. */
export function horaDeGuardado(instante: number): string {
  return new Date(instante).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
}

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.10 · Conflicto
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const CONFLICTO = {
  titulo: 'Este documento cambió mientras escribías',
  /**
   * **Fuera «alguien».** En este producto no hay nadie más —cada documento es de una sola persona—,
   * así que «alguien guardó una versión distinta» describe una intrusión que no ha ocurrido. Lo que
   * ha ocurrido es que fue ella misma, desde otro sitio.
   */
  cuerpo:
    'Lo guardaste distinto en otra pestaña o en otro dispositivo después de empezar aquí. Las dos versiones están completas: quédate con una.',
  descartar: 'Descartar lo que escribí',
  conservar: 'Conservar mi versión',
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.11 · Pestañas
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const PESTANAS = {
  lista: 'Documentos abiertos',
  region: 'Pestañas abiertas',
  sinTitulo: 'Documento sin título',
  nombreAccesible: (titulo: string, sinGuardar: boolean): string =>
    `«${titulo}»${sinGuardar ? ' · sin guardar' : ''} · Supr para cerrar`,
  /** Sujeto y verbo: quien lo oye acaba de hacerlo, y el anuncio se lo confirma. */
  cerrada: (titulo: string): string => `Has cerrado «${titulo}»`,
} as const;

/* ───────────────────────────────────────────────────────────────────────────────────────────────
   4.12 · Elementos del markdown
   ─────────────────────────────────────────────────────────────────────────────────────────── */

export const PALETA = {
  barra: 'Elementos de markdown',
  region: 'Elemento insertado',
  insertado: (rotulo: string): string => `Insertado: ${rotulo}`,
} as const;
