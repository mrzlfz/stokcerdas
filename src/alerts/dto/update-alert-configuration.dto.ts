import { PartialType } from '@nestjs/swagger';
import { CreateAlertConfigurationDto } from './create-alert-configuration.dto';

export class UpdateAlertConfigurationDto extends PartialType(
  CreateAlertConfigurationDto,
) {}
