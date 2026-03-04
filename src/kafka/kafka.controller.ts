import { Body, Controller, HttpCode, HttpStatus, Post } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { KafkaProducerService } from './kafka-producer.service';

interface PublishBody {
  topic: string;
  message: unknown;
}

@ApiTags('kafka')
@Controller('kafka')
export class KafkaController {
  constructor(private readonly kafkaProducerService: KafkaProducerService) {}

  @ApiOperation({ summary: 'Publish a message to a Kafka topic' })
  @ApiBody({ schema: { example: { topic: 'inventory.item-used', message: { remaining: 10, success: true, message: 'Item used.' } } } })
  @ApiResponse({ status: 202, schema: { example: { queued: true } } })
  @Post('publish')
  @HttpCode(HttpStatus.ACCEPTED)
  publish(@Body() body: PublishBody): { queued: boolean } {
    void this.kafkaProducerService.emit(body.topic, body.message);
    return { queued: true };
  }
}
