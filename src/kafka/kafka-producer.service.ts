import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ClientKafka } from '@nestjs/microservices';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class KafkaProducerService implements OnModuleInit {
  constructor(@Inject('KAFKA_CLIENT') private readonly client: ClientKafka) {}

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async emit<T>(topic: string, message: T): Promise<void> {
    await lastValueFrom(this.client.emit(topic, message));
  }
}
