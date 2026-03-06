import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import {
  IIdentityService,
  LoginResponse,
  RegisterDto,
} from '../interfaces/identity-service.interface';

interface AdminToken {
  value: string;
  expiresAt: number;
}

@Injectable()
export class KeycloakIdentityService implements IIdentityService {
  private adminToken: AdminToken | null = null;

  constructor(
    @InjectPinoLogger(KeycloakIdentityService.name)
    private readonly logger: PinoLogger,
    private readonly config: ConfigService,
  ) {}

  private get baseUrl(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_INTERNAL_URL');
  }

  private get realm(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_REALM');
  }

  private get loginClientId(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_LOGIN_CLIENT_ID');
  }

  private get adminClientId(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_ADMIN_CLIENT_ID');
  }

  private get adminClientSecret(): string {
    return this.config.getOrThrow<string>('KEYCLOAK_ADMIN_CLIENT_SECRET');
  }

  // ── Login ──────────────────────────────────────────────────────────────────

  async login(username: string, password: string): Promise<LoginResponse> {
    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'password',
      client_id: this.loginClientId,
      username,
      password,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (res.status === 401 || res.status === 400) {
      throw new UnauthorizedException('Invalid username or password');
    }

    if (!res.ok) {
      this.logger.error({ status: res.status }, 'Keycloak login failed');
      throw new InternalServerErrorException('Authentication service error');
    }

    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
      expires_in: number;
      token_type: string;
    };

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
      tokenType: data.token_type,
    };
  }

  // ── Register ───────────────────────────────────────────────────────────────

  async register(dto: RegisterDto): Promise<void> {
    const token = await this.getAdminToken();

    const userId = await this.createUser(dto, token);
    await this.assignRole(userId, 'product:read', token);
  }

  // ── Admin token (cached, refreshed before expiry) ──────────────────────────

  private async getAdminToken(): Promise<string> {
    const now = Date.now();
    if (this.adminToken && this.adminToken.expiresAt > now + 10_000) {
      return this.adminToken.value;
    }

    const url = `${this.baseUrl}/realms/${this.realm}/protocol/openid-connect/token`;
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: this.adminClientId,
      client_secret: this.adminClientSecret,
    });

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });

    if (!res.ok) {
      this.logger.error({ status: res.status }, 'Failed to get Keycloak admin token');
      throw new InternalServerErrorException('Authentication service error');
    }

    const data = (await res.json()) as { access_token: string; expires_in: number };
    this.adminToken = { value: data.access_token, expiresAt: now + data.expires_in * 1000 };
    return this.adminToken.value;
  }

  // ── Keycloak Admin API helpers ─────────────────────────────────────────────

  private async createUser(dto: RegisterDto, token: string): Promise<string> {
    const url = `${this.baseUrl}/admin/realms/${this.realm}/users`;

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        username: dto.username,
        email: dto.email,
        firstName: dto.firstName,
        lastName: dto.lastName,
        enabled: true,
        emailVerified: true,
        requiredActions: [],
        credentials: [{ type: 'password', value: dto.password, temporary: false }],
      }),
    });

    if (res.status === 409) {
      throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    if (!res.ok) {
      this.logger.error({ status: res.status }, 'Keycloak create user failed');
      throw new InternalServerErrorException('Failed to create user');
    }

    // Keycloak returns the user ID in the Location header
    const location = res.headers.get('Location') ?? '';
    const userId = location.split('/').pop();
    if (!userId) {
      throw new InternalServerErrorException('Could not determine new user ID');
    }
    return userId;
  }

  private async assignRole(userId: string, roleName: string, token: string): Promise<void> {
    // Fetch the role representation (need the id field for assignment)
    const roleUrl = `${this.baseUrl}/admin/realms/${this.realm}/roles/${roleName}`;
    const roleRes = await fetch(roleUrl, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!roleRes.ok) {
      this.logger.error({ status: roleRes.status, roleName }, 'Failed to fetch role');
      throw new InternalServerErrorException('Failed to assign user role');
    }

    const role = (await roleRes.json()) as { id: string; name: string };

    const assignUrl = `${this.baseUrl}/admin/realms/${this.realm}/users/${userId}/role-mappings/realm`;
    const assignRes = await fetch(assignUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify([{ id: role.id, name: role.name }]),
    });

    if (!assignRes.ok) {
      this.logger.error({ status: assignRes.status, roleName, userId }, 'Failed to assign role');
      throw new InternalServerErrorException('Failed to assign user role');
    }
  }
}
