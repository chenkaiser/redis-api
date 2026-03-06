import * as Joi from 'joi';

export const configValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  LOG_LEVEL: Joi.string()
    .valid('trace', 'debug', 'info', 'warn', 'error')
    .default('info'),

  AUTH_PROVIDER_TYPE: Joi.string()
    .valid('keycloak', 'entra-id')
    .default('keycloak'),

  // Redis
  REDIS_HOST: Joi.string().default('localhost'),
  REDIS_PORT: Joi.number().integer().positive().default(6379),
  REDIS_PASSWORD: Joi.string().required(),

  // Kafka
  KAFKA_BROKER: Joi.string().default('localhost:9092'),
  KAFKA_USER: Joi.string().default('admin'),
  KAFKA_PASSWORD: Joi.string().required(),

  // Keycloak (required when AUTH_PROVIDER_TYPE=keycloak)
  KEYCLOAK_JWKS_URI: Joi.string().default(
    'http://keycloak:8080/realms/redis-api/protocol/openid-connect/certs',
  ),
  KEYCLOAK_ISSUER: Joi.string().default(
    'http://localhost:8080/realms/redis-api',
  ),
  KEYCLOAK_AUDIENCE: Joi.string().default('product-api'),
  KEYCLOAK_INTERNAL_URL: Joi.string().default('http://keycloak:8080'),
  KEYCLOAK_REALM: Joi.string().default('redis-api'),
  KEYCLOAK_LOGIN_CLIENT_ID: Joi.string().default('api-test'),
  KEYCLOAK_ADMIN_CLIENT_ID: Joi.string().default('auth-service'),
  // No default — must be supplied explicitly; app refuses to start if missing.
  KEYCLOAK_ADMIN_CLIENT_SECRET: Joi.string().required(),

  // Entra ID (only needed when AUTH_PROVIDER_TYPE=entra-id)
  ENTRA_TENANT_ID: Joi.string().allow('').optional(),
  ENTRA_CLIENT_ID: Joi.string().allow('').optional(),
});
