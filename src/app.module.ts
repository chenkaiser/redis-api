import { Module } from '@nestjs/common';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { KafkaModule } from './kafka/kafka.module';
import { ProductModule } from './product/product.module';
import { RedisModule } from './redis/redis.module';

@Module({
  controllers: [AppController],
  imports: [
    LoggerModule.forRoot({
      pinoHttp: {
        level: process.env.LOG_LEVEL ?? 'info',
        transport:
          process.env.NODE_ENV !== 'production'
            ? { target: 'pino-pretty', options: { singleLine: true } }
            : undefined,
      },
    }),
    RedisModule,
    ProductModule,
    KafkaModule,
  ],
})
export class AppModule {}
