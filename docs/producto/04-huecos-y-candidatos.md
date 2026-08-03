# 4. Huecos y candidatos a lo siguiente

Menú de lo que **no existe**, agrupado por el problema que resolvería. Las columnas de coste son
**estimaciones a ojo**, útiles para comparar entre sí, no compromisos: alto ≈ una spec grande con
backend y modelo de datos; medio ≈ una spec normal; bajo ≈ una spec pequeña o solo frontend.

Las siete specs cerradas agotaron el brief original. **Todo lo de abajo es alcance nuevo, y ninguna
de estas decisiones se puede priorizar bien sin responder antes
[`06-preguntas-abiertas.md`](06-preguntas-abiertas.md).**

## A. La herramienta no sirve a nadie que no seas tú

| Hueco | Por qué importa | Coste |
|---|---|---|
| **No está desplegada en ningún sitio** | Hoy solo corre en la máquina de desarrollo. Sin esto, ninguna otra decisión de producto tiene consecuencias observables | Medio |
| **Sin recuperación de contraseña** | Bloqueado por no tener proveedor de correo. **Con usuarios reales es un bloqueante duro**: quien olvida la contraseña pierde la cuenta | Bajo-medio + elegir proveedor |
| **Sin diseño responsive** | La interfaz asume escritorio. Un enlace abierto en el móvil hoy no funciona bien | Medio |
| **Sin onboarding ni estado inicial guiado** | Quien entra por primera vez ve un árbol vacío | Bajo |

## B. Con muchos documentos, la herramienta se rompe de uso

| Hueco | Por qué importa | Coste |
|---|---|---|
| **Sin búsqueda** (por título o por contenido) | Con el límite vigente de 5.000 nodos, navegar el árbol a mano deja de servir mucho antes. **Es el hueco más grande del producto tal como está** | Medio-alto |
| **Sin documentos recientes ni favoritos** | El único camino a un documento es recordar dónde lo dejaste | Bajo |
| **Sin etiquetas ni metadatos** (frontmatter) | Segundo eje de organización, alternativo a las carpetas | Medio |
| **Sin enlaces entre documentos** (`[[wikilinks]]`) | Es la mecánica que separa «carpeta de notas» de «base de conocimiento». Cambia la naturaleza del producto | Alto |

## C. La confianza tiene agujeros conocidos

| Hueco | Por qué importa | Coste |
|---|---|---|
| **Borrado definitivo, sin papelera** | Un clic mal dado pierde trabajo para siempre. Hay confirmación, pero no vuelta atrás | Medio |
| **Sin historial de versiones** | El autoguardado escribe encima. No hay forma de volver a lo de ayer | Alto |
| **Sin exportar ni importar** | No se puede sacar el trabajo de la aplicación. Para una herramienta de notas personales, es un compromiso que muchos usuarios miran antes de entrar | Bajo (exportar) / Medio (importar) |
| **Sin copias de seguridad** | Fuera de alcance desde el principio; con datos reales pasa a ser obligatorio | Medio |

## D. Fricciones del día a día

| Hueco | Por qué importa | Coste |
|---|---|---|
| **Las pestañas no sobreviven a una recarga** | Rompe la ilusión de «editor» que las propias pestañas prometen | Medio |
| **Sin scroll sincronizado en vista dividida** | Con documentos largos, la vista dividida pierde casi todo su valor. **Mejor relación coste/retorno de esta tabla** | Bajo |
| **Sin drag & drop en el árbol** | El diálogo funciona y es accesible, pero mover mucho contenido cansa | Bajo-medio |
| **Sin subir imágenes** | La paleta inserta la sintaxis de imagen y no hay forma de tener una imagen propia que enlazar | Medio-alto (almacenamiento) |
| **Sin menú contextual de pestañas** ni reordenarlas | Se echa de menos en cuanto hay más de cinco abiertas | Bajo |
| **Sin resaltado de sintaxis en el editor** | Es un `<textarea>` plano. **Cambiar esto es el cambio más caro del producto**: reabre paleta, deshacer y caret | Muy alto |

## E. Aperturas que cambiarían lo que es el producto

Ninguna es «lo siguiente»: son cambios de rumbo, y cada una invalida decisiones cerradas.

- **Compartir un documento** (enlace público de solo lectura → colaboración en tiempo real). Cada
  escalón es una herramienta distinta; el primero es asequible, el último es otro producto.
- **Equipos y espacios compartidos.** Rompe «un usuario, sus documentos» de raíz.
- **Publicar**: convertir una carpeta en un sitio o blog estático. Aprovecha todo lo construido y no
  toca casi nada del modelo actual.
- **API pública o integraciones** (Git, Obsidian, Drive). Convierte la herramienta en pieza de un flujo
  ajeno en vez de destino final.
- **Asistencia de escritura con IA.** Encaja con la tesis de «markdown para quien no sabe markdown»,
  y es también la vía más rápida a parecerse a todos los demás.

## Si hubiera que apostar hoy (sujeto a las preguntas abiertas)

1. **Despliegue + recuperación de contraseña** — sin esto no hay usuarios, y sin usuarios no hay
   señal para decidir el resto.
2. **Búsqueda** — es el hueco que más pronto duele con uso real.
3. **Scroll sincronizado** — barato, y arregla una feature que ya existe.
4. **Exportar** — barato, y quita la objeción de «me quedo encerrado».
