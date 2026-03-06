import { SetMetadata } from '@nestjs/common';

export const ROLES_KEY = 'roles';

/** Require one or more realm roles on the authenticated token. */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
