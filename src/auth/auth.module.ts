import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { AUTH_PROVIDER } from './interfaces/auth-provider.interface';
import { IDENTITY_SERVICE } from './interfaces/identity-service.interface';
import { KeycloakProvider } from './providers/keycloak.provider';
import { EntraIdProvider } from './providers/entra-id.provider';
import { KeycloakIdentityService } from './services/keycloak-identity.service';
import { EntraIdIdentityService } from './services/entra-id-identity.service';
import { JwtStrategy } from './jwt.strategy';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { RolesGuard } from './guards/roles.guard';
import { BloomFilterService } from './bloom-filter.service';
import { AuthController } from './auth.controller';
import { RedisModule } from '../redis/redis.module';

/**
 * Selects the active OIDC provider at startup via AUTH_PROVIDER_TYPE env var.
 *
 *   AUTH_PROVIDER_TYPE=keycloak   → Keycloak  (default)
 *   AUTH_PROVIDER_TYPE=entra-id   → Azure Entra ID
 *
 * Both AUTH_PROVIDER (JWT validation) and IDENTITY_SERVICE (login/register)
 * switch together — no other code changes needed to migrate providers.
 */
@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), RedisModule],
  controllers: [AuthController],
  providers: [
    // Register both concrete providers so NestJS can inject ConfigService into them.
    // The AUTH_PROVIDER token then resolves to whichever the env var selects.
    KeycloakProvider,
    EntraIdProvider,
    {
      provide: AUTH_PROVIDER,
      useFactory: (
        config: ConfigService,
        keycloak: KeycloakProvider,
        entra: EntraIdProvider,
      ) => (config.get('AUTH_PROVIDER_TYPE') === 'entra-id' ? entra : keycloak),
      inject: [ConfigService, KeycloakProvider, EntraIdProvider],
    },

    KeycloakIdentityService,
    EntraIdIdentityService,
    {
      provide: IDENTITY_SERVICE,
      useFactory: (
        config: ConfigService,
        keycloak: KeycloakIdentityService,
        entra: EntraIdIdentityService,
      ) => (config.get('AUTH_PROVIDER_TYPE') === 'entra-id' ? entra : keycloak),
      inject: [ConfigService, KeycloakIdentityService, EntraIdIdentityService],
    },

    JwtStrategy,
    JwtAuthGuard,
    RolesGuard,
    BloomFilterService,
  ],
  exports: [JwtAuthGuard, RolesGuard, PassportModule, AUTH_PROVIDER],
})
export class AuthModule {}
