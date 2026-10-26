import { plainToInstance } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  validateSync,
} from 'class-validator';

class EnvironmentVariables {
  @IsString()
  DATABASE_URL: string;

  @IsString()
  JWT_SECRET: string;

  @IsString()
  @IsOptional()
  JWT_EXPIRES_IN: string = '1h';

  @IsNumber()
  @IsOptional()
  PORT: number = 3000;

  @IsString()
  @IsOptional()
  NODE_ENV: string = 'development';

  @IsString()
  @IsOptional()
  CORS_ORIGIN: string = 'http://localhost:5173';

  @IsString()
  @IsOptional()
  STORAGE_DRIVER: string = 'local';

  @IsString()
  @IsOptional()
  R2_ENDPOINT?: string;

  @IsString()
  @IsOptional()
  R2_BUCKET?: string;

  @IsString()
  @IsOptional()
  R2_ACCESS_KEY_ID?: string;

  @IsString()
  @IsOptional()
  R2_SECRET_ACCESS_KEY?: string;

  @IsString()
  @IsOptional()
  SMTP_HOST?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  SMTP_PORT?: number;

  @IsString()
  @IsOptional()
  SMTP_USER?: string;

  @IsString()
  @IsOptional()
  SMTP_PASSWORD?: string;

  @IsString()
  @IsOptional()
  SMTP_FROM?: string;
}

export function validate(config: Record<string, unknown>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validatedConfig, {
    skipMissingProperties: false,
  });

  if (errors.length > 0) {
    throw new Error(errors.toString());
  }

  const smtpSettings = [
    validatedConfig.SMTP_HOST,
    validatedConfig.SMTP_PORT,
    validatedConfig.SMTP_FROM,
  ];
  if (smtpSettings.some(Boolean) && smtpSettings.some((setting) => !setting)) {
    throw new Error(
      'SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured together',
    );
  }
  if (
    Boolean(validatedConfig.SMTP_USER) !==
    Boolean(validatedConfig.SMTP_PASSWORD)
  ) {
    throw new Error('SMTP_USER and SMTP_PASSWORD must be configured together');
  }

  if (validatedConfig.NODE_ENV === 'production') {
    const productionErrors: string[] = [];

    if (validatedConfig.JWT_SECRET.length < 32) {
      productionErrors.push('JWT_SECRET must contain at least 32 characters');
    }

    try {
      const corsOrigin = new URL(validatedConfig.CORS_ORIGIN);
      if (
        corsOrigin.protocol !== 'https:' ||
        corsOrigin.origin !== validatedConfig.CORS_ORIGIN
      ) {
        productionErrors.push(
          'CORS_ORIGIN must be an HTTPS origin without a path',
        );
      }
    } catch {
      productionErrors.push('CORS_ORIGIN must be a valid HTTPS origin');
    }

    try {
      const databaseUrl = new URL(validatedConfig.DATABASE_URL);
      const sslMode = databaseUrl.searchParams.get('sslmode');
      if (
        !['postgres:', 'postgresql:'].includes(databaseUrl.protocol) ||
        !['require', 'verify-full'].includes(sslMode ?? '')
      ) {
        productionErrors.push(
          'DATABASE_URL must use PostgreSQL with sslmode=require or verify-full',
        );
      }
    } catch {
      productionErrors.push('DATABASE_URL must be a valid PostgreSQL URL');
    }

    if (validatedConfig.STORAGE_DRIVER !== 'r2') {
      productionErrors.push('STORAGE_DRIVER must be r2 in production');
    }

    if (
      !validatedConfig.R2_BUCKET ||
      !validatedConfig.R2_ACCESS_KEY_ID ||
      !validatedConfig.R2_SECRET_ACCESS_KEY
    ) {
      productionErrors.push(
        'R2_BUCKET, R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required in production',
      );
    }

    try {
      const endpoint = new URL(validatedConfig.R2_ENDPOINT ?? '');
      if (
        endpoint.protocol !== 'https:' ||
        !endpoint.hostname.endsWith('.r2.cloudflarestorage.com') ||
        endpoint.pathname !== '/' ||
        endpoint.search ||
        endpoint.hash
      ) {
        productionErrors.push(
          'R2_ENDPOINT must be a Cloudflare R2 HTTPS endpoint',
        );
      }
    } catch {
      productionErrors.push(
        'R2_ENDPOINT must be a valid Cloudflare R2 HTTPS endpoint',
      );
    }

    if (productionErrors.length > 0) {
      throw new Error(
        `Invalid production configuration: ${productionErrors.join('; ')}`,
      );
    }
  }

  return validatedConfig;
}
