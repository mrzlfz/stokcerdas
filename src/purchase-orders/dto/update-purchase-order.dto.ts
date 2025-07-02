import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';

export class UpdatePurchaseOrderDto extends PartialType(
  OmitType(CreatePurchaseOrderDto, ['items'] as const),
) {
  // All fields from CreatePurchaseOrderDto are optional for updates
  // Items are handled separately through dedicated endpoints
}