import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.setGlobalPrefix('api');
  const origins = process.env.FRONTEND_URL?.split(',').map((s) => s.trim());
  app.enableCors({ origin: origins?.length ? origins : true, credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useStaticAssets(join(process.cwd(), process.env.UPLOAD_DIR || 'uploads'), { prefix: '/uploads' });
  const port = Number(process.env.PORT || 3100);
  await app.listen(port);
  Logger.log(`API lista en http://localhost:${port}/api`, 'Bootstrap');
}
bootstrap();
