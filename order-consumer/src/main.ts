import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createMicroservice<MicroserviceOptions>(AppModule, {
    bufferLogs: true,
    transport: Transport.KAFKA,
    options: {
      client: {
        clientId: 'order-consumer',
        brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
        sasl: {
          mechanism: 'plain',
          username: process.env.KAFKA_USER ?? '',
          password: process.env.KAFKA_PASSWORD ?? '',
        },
      },
      consumer: {
        groupId: 'order-consumer-group',
        autoCommit: false,
      },
    },
  });
  app.useLogger(app.get(Logger));
  await app.listen();
  app.get(Logger).log('order-consumer microservice is listening', 'Bootstrap');
}

void bootstrap();
