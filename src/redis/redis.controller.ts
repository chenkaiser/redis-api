import { Controller, Get, Post, Delete, Param, Body, Query } from '@nestjs/common';
import { ApiBody, ApiOperation, ApiParam, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import { RedisService } from './redis.service';

@ApiTags('redis')
@Controller('redis')
export class RedisController {
  constructor(private readonly redisService: RedisService) {}

  @ApiOperation({ summary: 'Write a key-value pair' })
  @ApiBody({ schema: { example: { key: 'my-key', value: 'my-value', ttl: 60 } } })
  @ApiResponse({ status: 201, schema: { example: { success: true, key: 'my-key' } } })
  @Post()
  async set(@Body() body: { key: string; value: string; ttl?: number }) {
    await this.redisService.set(body.key, body.value, body.ttl);
    return { success: true, key: body.key };
  }

  @ApiOperation({ summary: 'Read a value by key' })
  @ApiParam({ name: 'key', example: 'my-key' })
  @ApiResponse({ status: 200, schema: { example: { key: 'my-key', value: 'my-value' } } })
  @Get(':key')
  async get(@Param('key') key: string) {
    const value = await this.redisService.get(key);
    return { key, value };
  }

  @ApiOperation({ summary: 'Delete a key' })
  @ApiParam({ name: 'key', example: 'my-key' })
  @ApiResponse({ status: 200, schema: { example: { key: 'my-key', deleted: true } } })
  @Delete(':key')
  async del(@Param('key') key: string) {
    const deleted = await this.redisService.del(key);
    return { key, deleted: deleted > 0 };
  }

  @ApiOperation({ summary: 'List all keys matching a pattern' })
  @ApiQuery({ name: 'pattern', required: false, example: 'inventory*' })
  @ApiResponse({ status: 200, schema: { example: { keys: ['inventory', 'lock:inventory'] } } })
  @Get()
  async keys(@Query('pattern') pattern?: string) {
    const keys = await this.redisService.keys(pattern || '*');
    return { keys };
  }
}
