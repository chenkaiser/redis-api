import {
  Body,
  ConflictException,
  Controller,
  HttpCode,
  HttpStatus,
  Inject,
  Post,
} from '@nestjs/common';
import { ApiBody, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Public } from './decorators/public.decorator';
import { BloomFilterService } from './bloom-filter.service';
import {
  IDENTITY_SERVICE,
  IIdentityService,
  LoginResponse,
  RegisterDto,
} from './interfaces/identity-service.interface';

@Public()
@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    @InjectPinoLogger(AuthController.name) private readonly logger: PinoLogger,
    @Inject(IDENTITY_SERVICE) private readonly identity: IIdentityService,
    private readonly bloomFilter: BloomFilterService,
  ) {}

  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login and receive tokens' })
  @ApiBody({ schema: { example: { username: 'testuser', password: 'testuser123' } } })
  @ApiResponse({ status: 200, description: 'Login successful', schema: { example: { accessToken: '...', refreshToken: '...', expiresIn: 300, tokenType: 'Bearer' } } })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async login(
    @Body() body: { username: string; password: string },
  ): Promise<LoginResponse> {
    this.logger.info({ username: body.username }, 'POST /auth/login');
    return this.identity.login(body.username, body.password);
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new user' })
  @ApiBody({ schema: { example: { username: 'newuser', password: 'Password123!', email: 'new@example.com', firstName: 'New', lastName: 'User' } } })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 409, description: 'Username already taken' })
  async register(@Body() dto: RegisterDto): Promise<{ message: string }> {
    this.logger.info({ username: dto.username }, 'POST /auth/register');

    // Fast-path duplicate check via Bloom filter — avoids hitting Keycloak
    // for usernames that are definitely already registered.
    // False positives are possible: Keycloak will return 409 in that case.
    const mightExist = await this.bloomFilter.mightExist(dto.username);
    if (mightExist) {
      this.logger.info({ username: dto.username }, 'Bloom filter: username likely taken');
      throw new ConflictException(`Username '${dto.username}' is already taken`);
    }

    await this.identity.register(dto);

    // Add to filter only after successful registration
    await this.bloomFilter.add(dto.username);

    this.logger.info({ username: dto.username }, 'User registered');
    return { message: 'User registered successfully' };
  }
}
