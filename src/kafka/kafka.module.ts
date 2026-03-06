import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [
    ClientsModule.registerAsync([
      {
        name: 'KAFKA_CLIENT',
        imports: [ConfigModule],
        useFactory: (config: ConfigService) => ({
          transport: Transport.KAFKA,
          options: {
            client: {
              clientId: 'redis-api-producer',
              brokers: [config.getOrThrow<string>('KAFKA_BROKER')],
              sasl: {
                mechanism: 'plain',
                username: config.getOrThrow<string>('KAFKA_USER'),
                password: config.getOrThrow<string>('KAFKA_PASSWORD'),
              },
            },
          },
        }),
        inject: [ConfigService],
      },
    ]),
  ],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
