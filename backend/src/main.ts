import { NestFactory } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { AppModule } from './app.module';
import helmet from 'helmet';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  // Seguridad
  app.use(helmet());

  // CORS
  app.enableCors({
    origin: configService.get('cors.origin'),
    credentials: true,
  });

  // Filtros globales
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new TransformInterceptor());

  // Validación global
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );

  // Prefijo global
  app.setGlobalPrefix('api');

  const port = configService.get('port');
  await app.listen(port);
  
  logger.log(` Backend corriendo en: http://localhost:${port}/api`);
  logger.log(` Health check: http://localhost:${port}/api/health`);
}

bootstrap();