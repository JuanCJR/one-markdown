import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

import { ErrorResponseDto } from './common/dto/error.response.dto';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { AppConfig } from './config/env.validation';
import { getAppVersion } from './common/app-version';

/**
 * Configuración compartida por `main.ts` y por los e2e.
 * Vive aquí para que los tests ejerciten exactamente la misma app que se despliega.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api');

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

  const config = app.get(ConfigService<AppConfig, true>);

  // Swagger describe el contrato interno de la API: fuera de producción, y solo ahí.
  if (config.get('NODE_ENV', { infer: true }) !== 'production') {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder()
        .setTitle('One Markdown API')
        .setDescription('Gestión de documentos markdown organizados en directorios.')
        .setVersion(getAppVersion())
        .build(),
      // `ErrorResponseDto` es el contrato de error de toda la API, no de un endpoint concreto:
      // sin registrarlo como modelo extra no aparecería en el documento.
      { extraModels: [ErrorResponseDto] },
    );

    SwaggerModule.setup('api/docs', app, document);
  }
}
