import { Injectable, NestMiddleware, HttpStatus } from '@nestjs/common';
import { RedisService } from './redis.service';

const CAPACITY   = 100;  // max requests the bucket can hold
const LEAK_RATE  = 50;   // requests/sec that drain from the bucket

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  constructor(private readonly redisService: RedisService) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async use(req: any, res: any, next: () => void) {
    const identifier = req.ip ?? 'unknown';
    const { allowed, level } = await this.redisService.leakyBucket(
      identifier,
      CAPACITY,
      LEAK_RATE,
    );

    if (!allowed) {
      res.status(HttpStatus.TOO_MANY_REQUESTS).json({
        statusCode: 429,
        message: 'Too Many Requests',
        level,
      });
      return;
    }

    next();
  }
}
