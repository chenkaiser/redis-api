/**
 * Normalised shape of the decoded JWT payload stored on req.user.
 * Providers map their native claim structures into this shape via IAuthProvider.extractRoles().
 */
export interface TokenClaims {
  sub: string;
  iss: string;
  aud: string | string[];
  exp: number;
  roles: string[];
  /** Full raw payload — available for any provider-specific needs. */
  [key: string]: unknown;
}
