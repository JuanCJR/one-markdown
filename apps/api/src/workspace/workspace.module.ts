import { Module } from '@nestjs/common';

import { AuthModule } from '../auth';
import { DirectoriesController } from './directories.controller';
import { DirectoriesService } from './directories.service';
import { DocumentsController } from './documents.controller';
import { DocumentsService } from './documents.service';
import { WorkspaceController } from './workspace.controller';
import { WorkspaceRepository } from './workspace.repository';
import { WorkspaceService } from './workspace.service';

/**
 * Módulo del workspace: árbol de directorios y documentos markdown (spec 002).
 *
 * **Plano a propósito** (decisión 14 del plan): controlador → servicio → repositorio, más dos
 * módulos de dominio puro (`workspace-name.ts` y `tree-graph.ts`) que no se registran aquí porque
 * son funciones, no providers. La estructura hexagonal completa se descartó por la razón que da su
 * propia guía: esto es CRUD con pocas reglas sobre infraestructura fija. Lo que sí se respeta es el
 * límite que importa —el dominio no conoce Nest ni Prisma, y solo `WorkspaceRepository` inyecta el
 * cliente de base de datos—, y así se mantiene la coherencia con `src/auth/`, que ya es plano.
 *
 * `AuthModule` se importa por `JwtAuthGuard`, que los controladores usan con `@UseGuards`: es un
 * provider y sin el import no se resolvería en el injector de este módulo.
 *
 * **Un servicio por tipo de nodo** (`DirectoriesService`, `DocumentsService`) y no uno solo: los
 * endpoints de directorios y los de documentos se implementan en tareas distintas y en paralelo, y
 * con un servicio único las dos editarían el mismo archivo a la vez. El único archivo compartido es
 * éste, y el reparto lo hace secuencial.
 *
 * `WorkspaceController` + `WorkspaceService` son la lectura del árbol (`GET /tree`), lo único que
 * cruza los dos tipos de nodo y por eso no cuelga de ninguno de los dos servicios anteriores.
 */
@Module({
  imports: [AuthModule],
  controllers: [DirectoriesController, DocumentsController, WorkspaceController],
  // Sin `exports`: nadie fuera del workspace debe poder escribir en estas tablas. El día que otro
  // módulo lo necesite, se exporta un servicio con reglas, no el repositorio en crudo.
  providers: [WorkspaceRepository, DirectoriesService, DocumentsService, WorkspaceService],
})
export class WorkspaceModule {}
