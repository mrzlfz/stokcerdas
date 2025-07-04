import { PartialType, OmitType } from '@nestjs/swagger';
import { CreatePurchaseOrderDto } from './create-purchase-order.dto';
import { IsOptional, IsString } from 'class-validator';

export class UpdatePurchaseOrderDto extends PartialType(
  OmitType(CreatePurchaseOrderDto, ['items'] as const),
) {
  // All fields from CreatePurchaseOrderDto are optional for updates
  // Items are handled separately through dedicated endpoints

  @IsOptional()
  @IsString()
  updatedBy?: string;
}
