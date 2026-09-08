import 'reflect-metadata';
import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';
import { ServiceUnconfiguredFilter } from './common/service-unconfigured.filter';
import { UploadExceptionFilter } from './common/upload-exception.filter';

async function bootstrap(): Promise<void> {
  const logger = new Logger('Bootstrap');
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });

  // Every REST route lives under /api; nginx proxies that prefix through to
  // this service so the SPA and the API share one origin.
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: process.env.FRONTEND_URL ?? true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  });

  // Multipart uploads are capped by multer at 5 MB; these limits only cover
  // JSON and form bodies (captions run to 2200 characters).
  app.use(json({ limit: '2mb' }));
  app.use(urlencoded({ extended: true, limit: '2mb' }));

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip properties with no decorator: this is what makes an injected
      // `role: 'ADMIN'` on signup or `likeCount: 999` on a post edit a no-op.
      whitelist: true,
      transform: true,
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  // UploadExceptionFilter rewrites multer's 413 into the contract's 400;
  // ServiceUnconfiguredFilter turns a missing integration key into a 503.
  app.useGlobalFilters(new UploadExceptionFilter(), new ServiceUnconfiguredFilter());

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SnapGram API')
    .setDescription('Photo sharing — posts, comments, follows, reports and moderation')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, swaggerConfig));

  // Unprefixed liveness route retained from the scaffold surface. Registered on
  // the raw Express instance because the global prefix applies to every Nest
  // controller route without exception.
  app.getHttpAdapter().getInstance().get('/health', (_req: unknown, res: { json: (body: unknown) => void }) => {
    res.json({ status: 'ok' });
  });

  const port = parseInt(process.env.PORT ?? '3001', 10);
  await app.listen(port, '0.0.0.0');

  logger.log(`SnapGram API listening on port ${port}`);
  logger.log(`Swagger docs at /api/docs`);
}

void bootstrap();
