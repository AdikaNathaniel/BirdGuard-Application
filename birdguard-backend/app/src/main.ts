import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();

  // Global validation for every route: `whitelist` strips any request
  // body fields not declared on the DTO class, `transform` converts
  // incoming plain JSON into actual DTO class instances (so type
  // decorators/defaults apply), and `forbidNonWhitelisted: false` means
  // extra fields are silently dropped rather than rejecting the request.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );

  const port = Number(process.env.HTTP_PORT ?? 3000);
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`[app] HTTP server listening on port ${port}`);
}

bootstrap();
