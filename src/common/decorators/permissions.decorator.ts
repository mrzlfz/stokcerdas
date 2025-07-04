import { SetMetadata } from '@nestjs/common';
import {
  PermissionResource,
  PermissionAction,
} from '../../auth/entities/permission.entity';

export const PERMISSIONS_KEY = 'permissions';

export interface RequiredPermission {
  resource: PermissionResource;
  action: PermissionAction;
}

/**
 * Decorator to specify required permissions for accessing an endpoint
 *
 * @param permissions - Array of permissions required to access this endpoint
 *
 * @example
 * ```typescript
 * @Permissions({ resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE })
 * @Post('products')
 * createProduct() {
 *   // Only users with products:create permission can access
 * }
 * ```
 */
export const Permissions = (...permissions: RequiredPermission[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);

/**
 * Helper function to create permission objects more easily
 *
 * @example
 * ```typescript
 * @Permissions(
 *   Permission(PermissionResource.PRODUCTS, PermissionAction.CREATE),
 *   Permission(PermissionResource.INVENTORY, PermissionAction.UPDATE)
 * )
 * ```
 */
export const Permission = (
  resource: PermissionResource,
  action: PermissionAction,
): RequiredPermission => ({
  resource,
  action,
});
