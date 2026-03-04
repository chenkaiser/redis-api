import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { KafkaContext } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Repository } from 'typeorm';
import { InventoryEventDto } from './dto/inventory-event.dto';
import { Order } from './order.entity';

const BATCH_SIZE = 3;
const MAX_RETRIES = 5;
const RETRY_BASE_MS = 200;

interface BufferedEvent {
  dto: InventoryEventDto;
  context: KafkaContext;
}

@Injectable()
export class OrderService implements OnModuleDestroy {
  private buffer: BufferedEvent[] = [];
  private flushing = false;

  constructor(
    @InjectPinoLogger(OrderService.name) private readonly logger: PinoLogger,
    @InjectRepository(Order) private readonly repo: Repository<Order>,
  ) {}

  async createFromEvent(dto: InventoryEventDto, context: KafkaContext): Promise<void> {
    this.buffer.push({ dto, context });
    this.logger.debug({ bufferSize: this.buffer.length, batchSize: BATCH_SIZE }, 'Event buffered');
    if (this.buffer.length >= BATCH_SIZE && !this.flushing) {
      await this.flush();
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (this.buffer.length > 0) {
      await this.flush();
    }
  }

  private async flush(): Promise<void> {
    this.flushing = true;
    const batch = this.buffer.slice(0, BATCH_SIZE);
    const orders = batch.map(({ dto, context }) =>
      this.repo.create({
        remaining: dto.remaining,
        success: dto.success,
        message: dto.message,
        kafkaPartition: context.getPartition(),
        kafkaOffset: context.getMessage().offset,
      }),
    );

    this.logger.info({ batchSize: batch.length }, 'Batch flush started');
    const startMs = Date.now();

    let lastError: unknown;
    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const saved = await this.repo.save(orders);
        await this.commitOffsets(batch);
        this.buffer.splice(0, batch.length);
        this.flushing = false;
        this.logger.info(
          { count: saved.length, ids: saved.map((o) => o.id), durationMs: Date.now() - startMs },
          'Batch saved',
        );
        return;
      } catch (err) {
        lastError = err;
        const delay = RETRY_BASE_MS * 2 ** (attempt - 1);
        this.logger.warn(
          { attempt, maxRetries: MAX_RETRIES, delayMs: delay, err },
          'Batch save failed, retrying',
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    // Do NOT commit offsets — Kafka will re-deliver this batch on the next restart
    this.buffer.splice(0, batch.length);
    this.flushing = false;
    this.logger.error(
      { maxRetries: MAX_RETRIES, batch: batch.map((e) => e.dto), err: lastError },
      'Batch permanently failed — orders dead-lettered',
    );
  }

  private async commitOffsets(batch: BufferedEvent[]): Promise<void> {
    // Per partition, commit the highest offset + 1 seen in this batch
    const map = new Map<number, { topic: string; partition: number; offset: string }>();
    for (const { context } of batch) {
      const partition = context.getPartition();
      const offset = context.getMessage().offset;
      const prev = map.get(partition);
      if (!prev || BigInt(offset) > BigInt(prev.offset)) {
        map.set(partition, { topic: context.getTopic(), partition, offset });
      }
    }
    const consumer = batch[0].context.getConsumer();
    await consumer.commitOffsets(
      Array.from(map.values()).map(({ topic, partition, offset }) => ({
        topic,
        partition,
        offset: String(BigInt(offset) + 1n),
      })),
    );
  }
}
