import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { AUTH_BEARER_SCHEME } from '../common/api-security';
import { ErrorResponseDto } from '../common/dto/error.response.dto';
import { Throttled } from '../common/throttle';
import type { AppConfig } from '../config/env.validation';
import { AuthService, type IssuedSession } from './auth.service';
import type { AuthenticatedUser } from './authenticated-user';
import { CurrentUser } from './current-user.decorator';
import { AuthSessionResponseDto } from './dto/auth-session.response.dto';
import { LoginRequestDto } from './dto/login.request.dto';
import { LoginResponseDto } from './dto/login.response.dto';
import { RefreshRequestDto } from './dto/refresh.request.dto';
import { RegisterRequestDto } from './dto/register.request.dto';
import { UserResponseDto } from './dto/user.response.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import {
  issueRefreshCookie,
  REFRESH_COOKIE_NAME,
  RefreshCookie,
  revokeRefreshCookie,
} from './refresh-cookie';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('register')
  @Throttled('register')
  @ApiOperation({ summary: 'Crea una cuenta y abre sesión', operationId: 'register' })
  @ApiCreatedResponse({
    type: AuthSessionResponseDto,
    description: 'Sesión abierta; el refresh viaja en la cookie `om_refresh`',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'El correo ya está registrado' })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de altas por IP alcanzado',
  })
  async register(
    @Body() dto: RegisterRequestDto,
    // `passthrough` para poder emitir la cookie sin renunciar a devolver el DTO como cuerpo.
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    return this.respondWithSession(response, await this.auth.register(dto));
  }

  @Post('login')
  // Un login no crea un recurso: `200`, no el `201` que Nest pone por defecto en un POST.
  @HttpCode(HttpStatus.OK)
  @Throttled('login')
  @ApiOperation({ summary: 'Inicia sesión con correo y contraseña', operationId: 'login' })
  @ApiOkResponse({
    type: LoginResponseDto,
    description: 'Sesión abierta, o segundo factor pendiente si `mfaRequired` es `true`',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Credenciales inválidas (mismo mensaje exista o no la cuenta)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description:
      'Cuenta bloqueada temporalmente (el cuerpo trae `retryAfterSeconds`), o límite por IP alcanzado',
  })
  async login(
    @Body() dto: LoginRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<LoginResponseDto> {
    const outcome = await this.auth.login(dto);

    // Sin sesión no hay cookie: cuando falta el segundo factor, el navegador no debe quedarse con
    // nada que sirva para refrescar (AC-16).
    if (outcome.refreshToken !== null) {
      issueRefreshCookie(response, outcome.refreshToken, this.config);
    }

    return outcome.response;
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttled('refresh')
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({
    summary: 'Rota el refresh y emite un access token nuevo',
    operationId: 'refreshSession',
  })
  @ApiOkResponse({
    type: AuthSessionResponseDto,
    description: 'Sesión renovada; la cookie `om_refresh` se reemplaza por una de `jti` nuevo',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'El cuerpo debe ir vacío' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sin cookie, inválida, expirada, revocada o reutilizada (revoca la familia)',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite de renovaciones por IP alcanzado',
  })
  async refreshSession(
    // El DTO vacío existe para que el `ValidationPipe` rechace cualquier cuerpo; la credencial es la
    // cookie, y aceptar además un token en el cuerpo abriría una segunda superficie de entrada.
    @Body() _body: RefreshRequestDto,
    @RefreshCookie() refreshToken: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    return this.respondWithSession(response, await this.auth.refresh(refreshToken));
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  // Comparte cupo con `refresh` y `me`: son las tres peticiones de mantenimiento de sesión, y ninguna
  // debería repetirse decenas de veces por minuto desde la misma IP.
  @Throttled('refresh')
  @ApiCookieAuth(REFRESH_COOKIE_NAME)
  @ApiOperation({ summary: 'Cierra la sesión de este dispositivo', operationId: 'logout' })
  @ApiNoContentResponse({
    description: 'Sesión cerrada y cookie borrada. Idempotente: sin cookie también responde 204',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite por IP alcanzado',
  })
  async logout(
    @Body() _body: RefreshRequestDto,
    @RefreshCookie() refreshToken: string | null,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(refreshToken);

    // Se borra la cookie incluso si no había sesión: el navegador no debe quedarse con una
    // credencial que ya no sirve para nada.
    revokeRefreshCookie(response, this.config);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @Throttled('refresh')
  @ApiBearerAuth(AUTH_BEARER_SCHEME)
  @ApiOperation({ summary: 'Usuario del token de acceso', operationId: 'getCurrentUser' })
  @ApiOkResponse({ type: UserResponseDto })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sin token, expirado, firma inválida, `typ` distinto de `access` o usuario inexistente',
  })
  @ApiTooManyRequestsResponse({
    type: ErrorResponseDto,
    description: 'Límite por IP alcanzado',
  })
  getCurrentUser(@CurrentUser() user: AuthenticatedUser): UserResponseDto {
    // El guard ya resolvió la fila; aquí solo se proyecta al DTO, que es la única superficie pública.
    return new UserResponseDto(user);
  }

  /** Deja el refresh en la cookie y devuelve solo el DTO: el refresh nunca sale en el cuerpo. */
  private respondWithSession(response: Response, issued: IssuedSession): AuthSessionResponseDto {
    issueRefreshCookie(response, issued.refreshToken, this.config);
    return issued.session;
  }
}
