# One Markdown

# Descripcion

Aplicacion web para la gestion de archivos markdowns, estos archivos archivos markdown se almacenaran por categorias/directorios, subdirectorios, y se podran crear, editar, eliminar y visualizar los archivos markdown. La visualizacion del markdown podra ser en modo texto o en modo vista previa, Deberemos tener la opcion de poder tener un listado de elementos markdown para que el usuario pueda utilizaros de manera mas sencilla y rapida, ya que no todos los usuarios conocen la sintaxis correcta de un archivo markdown y de como debe ser estructurado, por lo que se le brindara un listado de elementos markdown para que pueda utilizarlos de manera mas sencilla y rapida. Se podran visualizar los archivos markdown dentro de tabs a medida que se van abriendo, al estilo de editores de codigo como vs code, tambien se debera agregar la opcion de dividir la vista para los markdowns que se abran

# Stack tecnologico

- Frontend: React, TailwindCSS, Zustand, vite, reac router, authjs

- Backend: Nodejs, Express, postgresql, prisma, JWT, bcrypt, MFA, redis, nestjs, config module de nest, swagger, class-validator, class-transformer, passport,

# Prompt

Vamos a comenzar el desarrollo de esta aplicacion, vamos a partir con definir los agentes y subagentes como:

- Agente Orchestrator: Este agente se encarga de pensar, analizar, planificar las tareas y delegar al subagente correspondiente para que ejecute la tarea. Este sub agente debera trabajar con la metodologia TDD y SDD para las planificaciones. Debera versionar con sdd y tambien debera dejar un archivo base de seguimiento de la implementacion en el cual le ira dando check a medida que las tareas se van completando.

- Agente Frontend: Este agente se encarga de la parte visual de la aplicacion especialista las tecnologias de frontend especificadas.

- Agente Backend: Este agente se encarga de la parte visual de la aplicacion especialista las tecnologias de frontend especificadas.

# Requisitos

1. Se deben asignar skills especificas a cada agente, empezaremos con una fase de discovery de skills que nos seran utiles, lo haremos a traves de skills.sh

2. Integraremos los siguientes mcp: context7, playwright, coderag, mcp para postgresql

3. En el backend cada respuesta y cada entrada debe estar definido en un DTO

Una vez finalicemos con los agentes vamos a planificar el desarrollo de la aplicacion pero ya esto lo haremos con la estrategia de tdd y ssd definidos
