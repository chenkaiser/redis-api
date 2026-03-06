import { Controller, Get } from '@nestjs/common';
import { Public } from './auth/decorators/public.decorator';

// Intentionally outside /redis — not covered by RateLimiterMiddleware.
// Used as a no-rate-limit baseline in benchmarks.
@Controller()
export class AppController {
  @Public()
  @Get('ping')
  ping() {
    return { pong: true };
  }
}
