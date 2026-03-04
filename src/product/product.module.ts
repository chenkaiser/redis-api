import { Module } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { RedisModule } from '../redis/redis.module';
import { ProductController } from './product.controller';

@Module({
  imports: [RedisModule, KafkaModule],
  controllers: [ProductController],
})
export class ProductModule {}
