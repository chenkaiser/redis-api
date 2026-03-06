import { Injectable, NotImplementedException } from '@nestjs/common';
import {
  IIdentityService,
  LoginResponse,
  RegisterDto,
} from '../interfaces/identity-service.interface';

/**
 * Azure Entra ID identity service — stub for future migration.
 *
 * Login:    Use MSAL with Authorization Code + PKCE (preferred) or
 *           Resource Owner Password Credentials via the /token endpoint.
 *           Env vars needed: ENTRA_TENANT_ID, ENTRA_CLIENT_ID
 *
 * Register: Use Microsoft Graph API POST /v1.0/users.
 *           Requires User.ReadWrite.All or Directory.ReadWrite.All permission
 *           on the app registration. Env vars needed: ENTRA_TENANT_ID,
 *           ENTRA_CLIENT_ID, ENTRA_CLIENT_SECRET (with Graph permissions).
 *
 * Set AUTH_PROVIDER_TYPE=entra-id to activate. No other code changes needed.
 */
@Injectable()
export class EntraIdIdentityService implements IIdentityService {
  async login(_username: string, _password: string): Promise<LoginResponse> {
    // TODO: POST https://login.microsoftonline.com/{tenant}/oauth2/v2.0/token
    //   grant_type=password, client_id, client_secret, username, password, scope
    throw new NotImplementedException('Entra ID login not yet implemented');
  }

  async register(_dto: RegisterDto): Promise<void> {
    // TODO: POST https://graph.microsoft.com/v1.0/users
    //   Authorization: Bearer {app_token_with_User.ReadWrite.All}
    //   Body: { displayName, userPrincipalName, passwordProfile, ... }
    throw new NotImplementedException('Entra ID registration not yet implemented');
  }
}
