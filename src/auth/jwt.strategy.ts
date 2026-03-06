import { Inject, Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { passportJwtSecret } from 'jwks-rsa';
import { AUTH_PROVIDER, IAuthProvider } from './interfaces/auth-provider.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(@Inject(AUTH_PROVIDER) provider: IAuthProvider) {
    super({
      secretOrKeyProvider: passportJwtSecret({
        cache: true,
        rateLimit: true,
        jwksRequestsPerMinute: 10,
        jwksUri: provider.getJwksUri(),
      }),
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      issuer: provider.getIssuer(),
      audience: provider.getAudience(),
      algorithms: ['RS256'],
    });
  }

  validate(payload: Record<string, unknown>): Record<string, unknown> {
    // Returned value is stored as req.user and passed to RolesGuard
    return payload;
  }
}
