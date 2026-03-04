import { Controller, Get } from '@nestjs/common';

// Intentionally outside /redis — not covered by RateLimiterMiddleware.
// Used as a no-rate-limit baseline in benchmarks.
@Controller()
export class AppController {
  @Get('ping')
  ping() {
    return { pong: true };
  }
}
