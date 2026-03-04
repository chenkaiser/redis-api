import { Module } from '@nestjs/common';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { KafkaController } from './kafka.controller';
import { KafkaProducerService } from './kafka-producer.service';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'KAFKA_CLIENT',
        transport: Transport.KAFKA,
        options: {
          client: {
            clientId: 'redis-api-producer',
            brokers: [process.env.KAFKA_BROKER ?? 'localhost:9092'],
          },
        },
      },
    ]),
  ],
  controllers: [KafkaController],
  providers: [KafkaProducerService],
  exports: [KafkaProducerService],
})
export class KafkaModule {}
