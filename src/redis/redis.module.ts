import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisController } from './redis.controller';
import { RateLimiterMiddleware } from './rate-limiter.middleware';

@Module({
  controllers: [RedisController],
  providers: [RedisService],
  exports: [RedisService],
})
export class RedisModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RateLimiterMiddleware).forRoutes('redis');
  }
}
