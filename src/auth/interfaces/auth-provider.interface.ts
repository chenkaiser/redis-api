export const AUTH_PROVIDER = 'AUTH_PROVIDER';

/**
 * Abstraction over OIDC providers.
 *
 * Keycloak implementation is active. To migrate to Azure Entra ID:
 *   1. Set env var AUTH_PROVIDER_TYPE=entra-id
 *   2. Supply ENTRA_TENANT_ID, ENTRA_CLIENT_ID env vars
 *   3. No code changes required in guards, strategy, or controllers.
 */
export interface IAuthProvider {
  /** URL of the provider's JWKS endpoint (used to fetch signing keys). */
  getJwksUri(): string;

  /**
   * Expected value of the `iss` claim in incoming JWTs.
   * Must match exactly what the provider puts in the token.
   */
  getIssuer(): string;

  /**
   * Expected value(s) of the `aud` claim.
   * Pass undefined to skip audience validation (not recommended in production).
   */
  getAudience(): string | string[] | undefined;

  /**
   * Extract a flat list of role strings from the decoded JWT payload.
   * - Keycloak: payload.realm_access.roles
   * - Entra ID: payload.roles
   */
  extractRoles(payload: Record<string, unknown>): string[];
}
