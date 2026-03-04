import { ApiProperty } from '@nestjs/swagger';

export class InventoryEventDto {
  @ApiProperty({ example: 42 })
  readonly remaining!: number;

  @ApiProperty({ example: true })
  readonly success!: boolean;

  @ApiProperty({ example: 'Item used. 42 left.' })
  readonly message!: string;
}
