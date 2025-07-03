// Re-export Permissions decorator from common
export { Permissions } from '../../common/decorators/permissions.decorator';

import { SetMetadata } from '@nestjs/common';

// Legacy permissions decorator that accepts string permissions
export const RequirePermissions = (...permissions: string[]) => 
  SetMetadata('legacy_permissions', permissions);