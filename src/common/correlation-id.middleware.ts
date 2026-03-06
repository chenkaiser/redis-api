import { Injectable, NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { correlationIdStorage } from './correlation-id.storage';

export const CORRELATION_ID_HEADER = 'x-correlation-id';

@Injectable()
export class CorrelationIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const id =
      (req.headers[CORRELATION_ID_HEADER] as string | undefined) ??
      randomUUID();
    res.setHeader(CORRELATION_ID_HEADER, id);
    // Run the rest of the request pipeline inside the AsyncLocalStorage
    // context so every log line and Kafka emit for this request carries
    // the same correlation ID without manual parameter passing.
    correlationIdStorage.run(id, next);
  }
}
