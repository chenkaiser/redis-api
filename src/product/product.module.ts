import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { KafkaModule } from '../kafka/kafka.module';
import { RedisModule } from '../redis/redis.module';
import { RateLimiterMiddleware } from '../redis/rate-limiter.middleware';
import { ProductController } from './product.controller';

@Module({
  imports: [RedisModule, KafkaModule],
  controllers: [ProductController],
})
export class ProductModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimiterMiddleware).forRoutes('product');
  }
}
