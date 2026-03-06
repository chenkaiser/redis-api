import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { AppController } from './app.controller';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import { KafkaModule } from './kafka/kafka.module';
import { ProductModule } from './product/product.module';
import { RedisModule } from './redis/redis.module';
import { configValidationSchema } from './config/config.schema';
import { CorrelationIdMiddleware } from './common/correlation-id.middleware';
import { getCorrelationId } from './common/correlation-id.storage';

@Module({
  controllers: [AppController],
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: configValidationSchema,
      validationOptions: { abortEarly: false },
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        pinoHttp: {
          level: config.getOrThrow<string>('LOG_LEVEL'),
          // Inject correlationId into every log line automatically.
          mixin: () => {
            const correlationId = getCorrelationId();
            return correlationId ? { correlationId } : {};
          },
          transport:
            config.getOrThrow<string>('NODE_ENV') !== 'production'
              ? { target: 'pino-pretty', options: { singleLine: true } }
              : undefined,
        },
      }),
    }),
    AuthModule,
    RedisModule,
    ProductModule,
    KafkaModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes('*');
  }
}
