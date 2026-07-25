import { ApiProperty } from '@nestjs/swagger';

/**
 * Datos del enrolamiento pendiente (specs/001-auth/plan.md §3, AC-13).
 *
 * Los tres primeros campos son el **mismo** secreto en tres formas: base32 para quien no puede
 * escanear, `otpauth://` para el enlace, y PNG para el QR. Se entregan una sola vez y no vuelven a
 * salir en ninguna respuesta posterior: el `enable` solo devuelve códigos de recuperación.
 */
export class MfaSetupResponseDto {
  @ApiProperty({
    type: String,
    example: 'JBSWY3DPEHPK3PXP',
    description: 'Secreto TOTP en base32, para introducirlo a mano si no se puede escanear el QR',
  })
  readonly secret: string;

  @ApiProperty({
    type: String,
    example: 'otpauth://totp/One%20Markdown:ada@example.test?secret=JBSWY3DPEHPK3PXP&issuer=One%20Markdown',
  })
  readonly otpauthUri: string;

  @ApiProperty({ type: String, description: 'PNG del QR como `data:image/png;base64,…`' })
  readonly qrCodeDataUrl: string;

  @ApiProperty({
    type: Number,
    example: 600,
    description: 'Segundos que sigue válido este enrolamiento sin confirmar',
  })
  readonly expiresInSeconds: number;

  constructor(params: {
    secret: string;
    otpauthUri: string;
    qrCodeDataUrl: string;
    expiresInSeconds: number;
  }) {
    this.secret = params.secret;
    this.otpauthUri = params.otpauthUri;
    this.qrCodeDataUrl = params.qrCodeDataUrl;
    this.expiresInSeconds = params.expiresInSeconds;
  }
}
