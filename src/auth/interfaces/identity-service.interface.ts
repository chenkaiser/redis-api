export const IDENTITY_SERVICE = 'IDENTITY_SERVICE';

export { RegisterDto } from '../dto/register.dto';

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
}

/**
 * Abstraction over identity operations that differ between OIDC providers.
 *
 * Keycloak implementation is active. To migrate to Azure Entra ID:
 *   - Login:    swap to MSAL Resource Owner Password / redirect flow
 *   - Register: swap to Microsoft Graph API POST /v1.0/users
 *   No changes needed in controllers or auth.module beyond setting
 *   AUTH_PROVIDER_TYPE=entra-id.
 */
export interface IIdentityService {
  login(username: string, password: string): Promise<LoginResponse>;
  register(dto: import('../dto/register.dto').RegisterDto): Promise<void>;
}
