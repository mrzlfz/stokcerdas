import { NestFactory, Reflector } from '@nestjs/core';
import { ValidationPipe, Logger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import * as compression from 'compression';
import rateLimit from 'express-rate-limit';

import { AppModule } from './app.module';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { TenantInterceptor } from './common/interceptors/tenant.interceptor';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);
  const logger = new Logger('Bootstrap');

  const port = configService.get<number>('PORT', 3000);
  const environment = configService.get<string>('NODE_ENV', 'development');

  // Security middleware
  app.use(helmet());
  app.use(compression());

  // Rate limiting
  app.use(
    rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 1000, // limit each IP to 1000 requests per windowMs
      message: 'Too many requests from this IP, please try again later.',
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // Global prefix for all routes
  app.setGlobalPrefix('api/v1');

  // Global pipes for validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      disableErrorMessages: environment === 'production',
    }),
  );

  // Global filters, guards, and interceptors
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalGuards(new JwtAuthGuard(app.get(Reflector)));
  app.useGlobalInterceptors(new LoggingInterceptor());
  app.useGlobalInterceptors(new TenantInterceptor(app.get(Reflector)));

  // CORS configuration
  app.enableCors({
    origin: configService.get<string>('CORS_ORIGIN', '*'),
    credentials: true,
  });

  // Swagger API documentation
  if (environment !== 'production') {
    const swaggerConfig = new DocumentBuilder()
      .setTitle('StokCerdas API')
      .setDescription('AI-Powered Inventory Intelligence Platform API')
      .setVersion('1.0')
      .addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
        'access-token',
      )
      .addTag('Auth', 'Authentication endpoints')
      .addTag('Users', 'User management endpoints')
      .addTag('Products', 'Product management endpoints')
      .addTag('Inventory', 'Inventory tracking endpoints')
      .addTag('Reports', 'Reporting endpoints')
      .addTag('Alerts', 'Alert system endpoints')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
      },
    });
  }

  await app.listen(port);

  logger.log(`🚀 StokCerdas API is running on port ${port}`);
  logger.log(`📖 API Documentation available at http://localhost:${port}/api/docs`);
  logger.log(`🔗 WebSocket Real-time Gateway available at ws://localhost:${port}/realtime`);
  logger.log(`🌍 Environment: ${environment}`);
}

bootstrap();