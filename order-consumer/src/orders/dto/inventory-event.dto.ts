export class InventoryEventDto {
  readonly remaining!: number;
  readonly success!: boolean;
  readonly message!: string;
  readonly correlationId?: string;
}
