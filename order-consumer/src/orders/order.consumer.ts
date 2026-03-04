import { Controller } from '@nestjs/common';
import { Ctx, EventPattern, KafkaContext, Payload } from '@nestjs/microservices';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { InventoryEventDto } from './dto/inventory-event.dto';
import { OrderService } from './order.service';

@Controller()
export class OrderConsumer {
  constructor(
    @InjectPinoLogger(OrderConsumer.name) private readonly logger: PinoLogger,
    private readonly orderService: OrderService,
  ) {}

  @EventPattern('inventory.item-used')
  async handleItemUsed(
    @Payload() data: InventoryEventDto,
    @Ctx() context: KafkaContext,
  ): Promise<void> {
    this.logger.info(
      { remaining: data.remaining, success: data.success },
      'inventory.item-used received',
    );
    await this.orderService.createFromEvent(data, context);
  }
}
