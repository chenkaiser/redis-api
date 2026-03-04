import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, Unique } from 'typeorm';

@Entity('orders')
@Unique(['kafkaPartition', 'kafkaOffset'])
export class Order {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'int' })
  remaining!: number;

  @Column({ type: 'boolean' })
  success!: boolean;

  @Column({ type: 'text' })
  message!: string;

  @Column({ type: 'int', name: 'kafka_partition' })
  kafkaPartition!: number;

  @Column({ type: 'text', name: 'kafka_offset' })
  kafkaOffset!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;
}
