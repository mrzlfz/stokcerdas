import { SetMetadata } from '@nestjs/common';
import { UserRole } from '../../users/entities/user.entity';

export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for accessing an endpoint
 *
 * @param roles - Array of roles that can access this endpoint
 *
 * @example
 * ```typescript
 * @Roles(UserRole.ADMIN, UserRole.MANAGER)
 * @Post('products')
 * createProduct() {
 *   // Only admins and managers can create products
 * }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
