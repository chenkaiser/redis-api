import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrderConsumer } from './order.consumer';
import { Order } from './order.entity';
import { OrderService } from './order.service';

@Module({
  imports: [TypeOrmModule.forFeature([Order])],
  controllers: [OrderConsumer],
  providers: [OrderService],
})
export class OrderModule {}
