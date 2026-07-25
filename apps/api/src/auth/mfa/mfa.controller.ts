import { Body, Controller, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import type { Response } from 'express';

import { ErrorResponseDto } from '../../common/dto/error.response.dto';
import type { AppConfig } from '../../config/env.validation';
import type { AuthenticatedUser } from '../authenticated-user';
import { CurrentUser } from '../current-user.decorator';
import { AuthSessionResponseDto } from '../dto/auth-session.response.dto';
import { UserResponseDto } from '../dto/user.response.dto';
import { JwtAuthGuard } from '../jwt-auth.guard';
import { setRefreshCookie } from '../refresh-cookie';
import { MfaDisableRequestDto } from './dto/mfa-disable.request.dto';
import { MfaEnableRequestDto } from './dto/mfa-enable.request.dto';
import { MfaRecoveryCodesResponseDto } from './dto/mfa-recovery-codes.response.dto';
import { MfaSetupResponseDto } from './dto/mfa-setup.response.dto';
import { MfaVerifyRequestDto } from './dto/mfa-verify.request.dto';
import { MfaService } from './mfa.service';

/**
 * Segundo factor TOTP (specs/001-auth/plan.md §3).
 *
 * `setup`, `enable` y `disable` son del usuario ya autenticado y van tras el Bearer; `verify` es
 * pública porque su credencial es el `mfaToken` que devolvió el login.
 *
 * Ningún handler loguea el secreto, el `otpauthUri`, el QR ni los códigos de recuperación.
 */
@ApiTags('auth')
@Controller('auth/mfa')
export class MfaController {
  constructor(
    private readonly mfa: MfaService,
    private readonly config: ConfigService<AppConfig, true>,
  ) {}

  @Post('setup')
  // Un enrolamiento sin confirmar no crea ningún recurso: `200`, no el `201` por defecto del POST.
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Inicia el alta del segundo factor y devuelve el secreto y su QR',
    operationId: 'mfaSetup',
  })
  @ApiOkResponse({
    type: MfaSetupResponseDto,
    description: 'Enrolamiento pendiente; el secreto vive en Redis con TTL y no toca la base',
  })
  @ApiUnauthorizedResponse({ type: ErrorResponseDto, description: 'Sin token o token inválido' })
  @ApiConflictResponse({ type: ErrorResponseDto, description: 'El segundo factor ya está activo' })
  async setup(@CurrentUser() user: AuthenticatedUser): Promise<MfaSetupResponseDto> {
    return this.mfa.setup(user);
  }

  @Post('enable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Confirma el alta del segundo factor con un código TOTP',
    operationId: 'mfaEnable',
  })
  @ApiOkResponse({
    type: MfaRecoveryCodesResponseDto,
    description: 'Segundo factor activo; los códigos de recuperación se muestran una única vez',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sin token, token inválido o código TOTP incorrecto',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'Ya estaba activo, o no hay enrolamiento pendiente (expiró)',
  })
  async enable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaEnableRequestDto,
  ): Promise<MfaRecoveryCodesResponseDto> {
    return this.mfa.enable(user, dto);
  }

  @Post('verify')
  @HttpCode(HttpStatus.OK)
  // Sin `JwtAuthGuard` a propósito: aquí todavía no hay sesión. La credencial es el `mfaToken` que
  // devolvió el login, y acredita solo que la contraseña ya fue correcta (plan §2 decisión 5).
  @ApiOperation({
    summary: 'Canjea el mfaToken del login por una sesión',
    operationId: 'mfaVerify',
  })
  @ApiOkResponse({
    type: AuthSessionResponseDto,
    description: 'Sesión abierta; el refresh viaja en la cookie `om_refresh`',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description:
      'mfaToken inválido, expirado o agotado, código incorrecto, o código de recuperación ya usado',
  })
  async verify(
    @Body() dto: MfaVerifyRequestDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthSessionResponseDto> {
    const issued = await this.mfa.verifyChallenge(dto);

    this.attachRefreshCookie(response, issued.refreshToken);

    return issued.session;
  }

  @Post('disable')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('bearer')
  @ApiOperation({
    summary: 'Da de baja el segundo factor con contraseña y código',
    operationId: 'mfaDisable',
  })
  @ApiOkResponse({
    type: UserResponseDto,
    description:
      'Segundo factor apagado: se borran el secreto y los códigos, y se cierran las demás sesiones',
  })
  @ApiBadRequestResponse({ type: ErrorResponseDto, description: 'Cuerpo inválido' })
  @ApiUnauthorizedResponse({
    type: ErrorResponseDto,
    description: 'Sin token, token inválido, o contraseña o código incorrectos',
  })
  @ApiConflictResponse({
    type: ErrorResponseDto,
    description: 'El segundo factor no estaba habilitado',
  })
  async disable(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MfaDisableRequestDto,
  ): Promise<UserResponseDto> {
    return this.mfa.disable(user, dto);
  }

  /**
   * Misma política de cookie que `AuthController`: el refresh solo sale por `Set-Cookie`, nunca en el
   * cuerpo, y `Secure` únicamente en producción (en dev la app corre en `http://localhost`, donde una
   * cookie `Secure` no se guardaría y el refresh quedaría inservible).
   */
  private attachRefreshCookie(response: Response, refreshToken: string): void {
    setRefreshCookie(response, refreshToken, {
      ttlSeconds: this.config.get('JWT_REFRESH_TTL', { infer: true }),
      secure: this.config.get('NODE_ENV', { infer: true }) === 'production',
    });
  }
}
