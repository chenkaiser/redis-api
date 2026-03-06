import { CanActivate, ExecutionContext, Inject, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_PROVIDER, IAuthProvider } from '../interfaces/auth-provider.interface';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    @Inject(AUTH_PROVIDER) private provider: IAuthProvider,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // No @Roles() decorator — authentication is enough
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<{ user: Record<string, unknown> }>();
    const userRoles = this.provider.extractRoles(user);

    return requiredRoles.every((role) => userRoles.includes(role));
  }
}
