import {
  Controller,
  Post,
  Get,
  Delete,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { randomUUID } from 'crypto';
import { getCorrelationId } from '../common/correlation-id.storage';
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Roles } from '../auth/decorators/roles.decorator';
import { InventoryEventDto } from '../kafka/dto/inventory-event.dto';
import { KafkaProducerService } from '../kafka/kafka-producer.service';
import { RedisService } from '../redis/redis.service';

const INVENTORY_KEY    = 'inventory';
const LOCK_KEY         = 'lock:inventory';
const INITIAL_STOCK    = 1000;
const LOCK_TTL_MS      = 300;  // critical section = 1 Redis eval (~1 ms); Kafka emit runs after lock release
const LOCK_RETRY_COUNT = 5;
const LOCK_RETRY_MS    = 50;   // back-off: 50→100→200→400→800 ms (~1.5 s total)

@ApiBearerAuth()
@ApiTags('product')
@Controller('product')
export class ProductController {
  constructor(
    @InjectPinoLogger(ProductController.name) private readonly logger: PinoLogger,
    private readonly redisService: RedisService,
    private readonly kafkaProducerService: KafkaProducerService,
  ) {}

  @Roles('product:write')
  @ApiOperation({ summary: 'Consume one inventory item', description: 'Acquires a distributed lock, decrements stock atomically, and publishes an event to Kafka. Retries lock acquisition up to 5 times with exponential back-off.' })
  @ApiResponse({ status: 200, description: 'Item consumed successfully' })
  @ApiResponse({ status: 200, description: 'Out of stock', schema: { example: { success: false, remaining: 0, message: 'no inventory available' } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient roles — requires product:write' })
  @ApiResponse({ status: 503, description: 'Lock contention — all retries exhausted' })
  @ApiResponse({ status: 503, description: 'Kafka unavailable — inventory decrement rolled back' })
  @Post('use-item')
  async useItem() {
    this.logger.info('POST /product/use-item');

    let token: string | null = null;
    for (let attempt = 1; attempt <= LOCK_RETRY_COUNT; attempt++) {
      token = await this.redisService.acquireLock(LOCK_KEY, LOCK_TTL_MS);
      if (token) break;
      const delay = LOCK_RETRY_MS * 2 ** (attempt - 1);
      this.logger.warn({ attempt, delayMs: delay }, 'Lock contention — retrying');
      await new Promise((resolve) => setTimeout(resolve, delay));
    }

    if (!token) {
      this.logger.warn({ retries: LOCK_RETRY_COUNT }, 'Lock contention — use-item rejected after retries');
      throw new HttpException(
        { message: 'Another transaction is in progress. Please retry shortly.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    // Lock covers only the atomic Redis decrement — release before the Kafka emit
    // so the lock TTL does not need to account for network latency to Kafka.
    let remaining: number;
    try {
      remaining = await this.redisService.checkAndDecrement(INVENTORY_KEY, INITIAL_STOCK);
    } finally {
      await this.redisService.releaseLock(LOCK_KEY, token);
    }

    if (remaining < 0) {
      this.logger.info({ remaining: 0 }, 'use-item: out of stock');
      return { success: false, remaining: 0, message: 'no inventory available' };
    }

    const message = remaining === 0 ? 'Last item used!' : `Item used. ${remaining} left.`;

    try {
      await this.kafkaProducerService.emit<InventoryEventDto>('inventory.item-used', {
        remaining,
        success: true,
        message,
        correlationId: getCorrelationId() ?? randomUUID(),
      });
    } catch (err) {
      // Kafka unavailable — undo the Redis decrement so inventory stays consistent
      await this.redisService.increment(INVENTORY_KEY);
      this.logger.error({ err }, 'Kafka emit failed — inventory rolled back');
      throw new HttpException(
        { message: 'Event delivery failed. Please retry.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }

    this.logger.info({ remaining }, 'use-item: success');
    return { success: true, remaining, message };
  }

  @Roles('product:read')
  @ApiOperation({ summary: 'Get current inventory' })
  @ApiResponse({ status: 200, schema: { example: { remaining: 999 } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient roles — requires product:read' })
  @Get('inventory')
  async getInventory() {
    this.logger.info('GET /product/inventory');
    const value = await this.redisService.get(INVENTORY_KEY);
    const remaining = value !== null ? parseInt(value, 10) : INITIAL_STOCK;
    this.logger.info({ remaining }, 'getInventory: result');
    return { remaining };
  }

  @Roles('product:admin')
  @ApiOperation({ summary: 'Reset inventory to initial stock (1000)' })
  @ApiResponse({ status: 200, schema: { example: { remaining: 1000, message: 'Inventory reset.' } } })
  @ApiResponse({ status: 401, description: 'Missing or invalid token' })
  @ApiResponse({ status: 403, description: 'Insufficient roles — requires product:admin' })
  @Delete('inventory')
  async resetInventory() {
    this.logger.info('DELETE /product/inventory');
    await this.redisService.set(INVENTORY_KEY, String(INITIAL_STOCK));
    this.logger.info({ remaining: INITIAL_STOCK }, 'resetInventory: done');
    return { remaining: INITIAL_STOCK, message: 'Inventory reset.' };
  }
}
