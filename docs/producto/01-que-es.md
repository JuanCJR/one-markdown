# 1. Qué es One Markdown

## La frase

Una **aplicación web para escribir y organizar documentos markdown en carpetas**, con cuenta propia y
documentos privados, pensada para que **también sirva a quien no domina la sintaxis markdown**.

## El encargo original

Del brief que abrió el proyecto (`prompt.md`, 2026-07-24), literal en lo que pide:

- Archivos markdown almacenados **por categorías, directorios y subdirectorios**.
- Crear, editar, eliminar y visualizar.
- Visualización **en modo texto o en vista previa**.
- **Un listado de elementos markdown** para insertarlos con un clic, «ya que no todos los usuarios
  conocen la sintaxis correcta de un archivo markdown».
- **Tabs al estilo VS Code** a medida que se abren documentos.
- **Vista dividida** — precisada el 2026-07-28 como texto y vista previa **del mismo documento**, no
  dos documentos distintos.

**Las cinco capacidades están implementadas.** Ver [`02-estado-del-producto.md`](02-estado-del-producto.md).

## La tesis de producto, tal como se deduce de lo construido

Nadie la escribió como tesis, pero las decisiones tomadas la dibujan de forma consistente:

> Markdown es el formato correcto para escribir, y su barrera de entrada es la sintaxis. Si la sintaxis
> deja de ser un requisito —paleta de elementos, vista previa al lado, deshacer que funciona— markdown
> sirve también a quien nunca lo aprendería.

El resto de la herramienta (árbol de carpetas, pestañas, autoguardado) es infraestructura conocida:
copia deliberadamente patrones que la gente ya sabe usar, sobre todo de VS Code.

## Lo que sí está claro que es

- **Personal y privado.** Un usuario, sus documentos, nadie más. Sin equipos, sin compartir, sin roles.
- **Serio con la seguridad.** MFA TOTP, bloqueo por fuerza bruta, preview sanitizado, autorización por
  recurso en cada acceso. Es una decisión de producto sostenida, no un añadido tardío.
- **Serio con la accesibilidad.** WCAG 2.2 AA no es una intención: hay criterios de aceptación con
  número de éxito citado (2.5.8, 1.4.1), y al menos un defecto real se detectó y arregló por ello.
- **En español.** Toda la interfaz, sin i18n ni preparación para otro idioma.

## Lo que NO está definido — y es lo primero que hay que decidir

El repositorio no contiene **ninguna** definición de:

- **A quién va dirigido.** No hay persona, segmento ni caso de uso concreto escrito en ningún sitio.
  Las historias de usuario dicen «como usuario», sin más.
- **Contra qué compite** y en qué se diferencia. Obsidian, Notion, HackMD, Bear, Joplin, Logseq y el
  propio VS Code no aparecen mencionados una sola vez en todo el proyecto.
- **Cómo llega a alguien.** No hay despliegue, ni dominio, ni landing, ni onboarding, ni analítica.
  Hoy es una aplicación que solo corre en la máquina de quien la desarrolla.
- **Si es un producto o un ejercicio.** Sin esa respuesta, la mitad de las decisiones de
  [`04-huecos-y-candidatos.md`](04-huecos-y-candidatos.md) no se pueden priorizar.
- **Qué significaría que va bien.** Ni una métrica, ni un objetivo.

Estas cinco son el contenido de [`06-preguntas-abiertas.md`](06-preguntas-abiertas.md).

## Una hipótesis explícita (marcada como tal)

No está en el repositorio; se ofrece solo como punto de partida para discutirla o tirarla:

> El usuario más probable es **quien ya escribe notas técnicas o documentación y quiere una carpeta
> ordenada sin instalar nada**, más **el compañero no técnico al que hay que arrastrar a ese mismo
> sitio**. La paleta y la vista dividida existen por el segundo; el árbol y las pestañas, por el
> primero. Si eso es cierto, el producto tiene dos usuarios con necesidades distintas y ninguna feature
> los reconoce todavía como distintos.
