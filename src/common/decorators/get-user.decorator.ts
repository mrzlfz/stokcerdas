import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { User } from '../../users/entities/user.entity';

/**
 * Decorator to extract the authenticated user from the request
 * 
 * @example
 * ```typescript
 * @Get('profile')
 * getProfile(@GetUser() user: User) {
 *   return user;
 * }
 * 
 * // Get specific user property
 * @Get('user-id')
 * getUserId(@GetUser('id') userId: string) {
 *   return { userId };
 * }
 * ```
 */
export const GetUser = createParamDecorator(
  (data: keyof User | undefined, ctx: ExecutionContext): User | any => {
    const request = ctx.switchToHttp().getRequest();
    const user: User = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);