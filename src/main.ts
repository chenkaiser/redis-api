import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const config = new DocumentBuilder()
    .setTitle('Redis API')
    .setDescription('Inventory management with distributed locking, rate limiting, and Kafka event publishing')
    .setVersion('1.0')
    .addBearerAuth()
    .build();
  SwaggerModule.setup('api', app, SwaggerModule.createDocument(app, config));

  await app.listen(3000);
  app.get(Logger).log('Application is running on http://localhost:3000', 'Bootstrap');
  app.get(Logger).log('Swagger UI available at http://localhost:3000/api', 'Bootstrap');
}

void bootstrap();
