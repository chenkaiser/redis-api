import { ApiProperty } from '@nestjs/swagger';

export class InventoryEventDto {
  @ApiProperty({ example: 42 })
  readonly remaining!: number;

  @ApiProperty({ example: true })
  readonly success!: boolean;

  @ApiProperty({ example: 'Item used. 42 left.' })
  readonly message!: string;

  @ApiProperty({ example: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890' })
  readonly correlationId!: string;
}
