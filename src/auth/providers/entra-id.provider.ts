import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { IAuthProvider } from '../interfaces/auth-provider.interface';

/**
 * Azure Entra ID (formerly Azure AD) OIDC provider — ready for future migration.
 *
 * To activate: set AUTH_PROVIDER_TYPE=entra-id and supply the env vars below.
 *
 * Env vars:
 *   ENTRA_TENANT_ID   – Azure AD tenant ID (GUID)
 *   ENTRA_CLIENT_ID   – App registration client ID (GUID)
 *
 * Key differences from Keycloak:
 *   - JWKS URI:  https://login.microsoftonline.com/{tenant}/discovery/v2.0/keys
 *   - Issuer:    https://login.microsoftonline.com/{tenant}/v2.0
 *   - Audience:  App ID URI, typically `api://{client-id}` or just the client GUID
 *   - Roles:     payload.roles  (app roles assigned in the Azure portal, not realm_access)
 *
 * No changes to guards, strategy, or controllers are needed — only this file and env vars.
 */
@Injectable()
export class EntraIdProvider implements IAuthProvider {
  constructor(private readonly config: ConfigService) {}

  getJwksUri(): string {
    const tenantId = this.config.get<string>('ENTRA_TENANT_ID', '');
    return `https://login.microsoftonline.com/${tenantId}/discovery/v2.0/keys`;
  }

  getIssuer(): string {
    const tenantId = this.config.get<string>('ENTRA_TENANT_ID', '');
    return `https://login.microsoftonline.com/${tenantId}/v2.0`;
  }

  getAudience(): string | undefined {
    return this.config.get<string>('ENTRA_CLIENT_ID');
  }

  extractRoles(payload: Record<string, unknown>): string[] {
    // Entra ID places app roles directly on payload.roles (not nested under realm_access)
    return (payload['roles'] as string[] | undefined) ?? [];
  }
}
