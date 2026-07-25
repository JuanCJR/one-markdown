import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { ErrorResponseDto } from './common/dto/error.response.dto';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import type { AppConfig } from './config/env.validation';
import { getAppVersion } from './common/app-version';

/**
 * Configuración compartida por `main.ts` y por los e2e.
 * Vive aquí para que los tests ejerciten exactamente la misma app que se despliega.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<AppConfig, true>);

  app.setGlobalPrefix('api');

  // El refresh token viaja en una cookie `HttpOnly`: sin este middleware `request.cookies` no existe
  // y el endpoint de refresh no tendría de dónde leer la credencial.
  app.use(cookieParser());

  // `credentials: true` con un origen explícito (nunca `*`, que el navegador prohíbe combinar con
  // credenciales): en dev el proxy de Vite hace mismo origen, pero en un despliegue con dominios
  // distintos la cookie de refresh no viajaría sin esto (decisión 13 de specs/001-auth/plan.md).
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());

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
