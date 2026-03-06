import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAuthProvider } from '../interfaces/auth-provider.interface';

/**
 * Keycloak OIDC provider.
 *
 * Env vars:
 *   KEYCLOAK_JWKS_URI   – JWKS endpoint reachable from this service
 *   KEYCLOAK_ISSUER     – Value of `iss` claim in issued tokens (external URL clients use)
 *   KEYCLOAK_AUDIENCE   – Expected `aud` claim value
 *
 * Roles are sourced from payload.realm_access.roles (Keycloak realm roles).
 */
@Injectable()
export class KeycloakProvider implements IAuthProvider {
  constructor(private readonly config: ConfigService) {}

  getJwksUri(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_JWKS_URI');
  }

  getIssuer(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_ISSUER');
  }

  getAudience(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_AUDIENCE');
  }

  extractRoles(payload: Record<string, unknown>): string[] {
    const realmAccess = payload['realm_access'] as { roles?: string[] } | undefined;
    return realmAccess?.roles ?? [];
  }
}
