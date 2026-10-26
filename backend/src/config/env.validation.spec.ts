import 'reflect-metadata';
import { validate } from './env.validation';

const productionConfig = {
  DATABASE_URL: 'postgresql://user:password@host.example/db?sslmode=require',
  JWT_SECRET: 'a-production-secret-with-at-least-32-characters',
  NODE_ENV: 'production',
  CORS_ORIGIN: 'https://denuncias-publicas.pages.dev',
  STORAGE_DRIVER: 'r2',
  R2_ENDPOINT: 'https://account.r2.cloudflarestorage.com',
  R2_BUCKET: 'private-evidence',
  R2_ACCESS_KEY_ID: 'access-key',
  R2_SECRET_ACCESS_KEY: 'secret-key',
};

describe('production environment validation', () => {
  it('accepts HTTPS, SSL database and private R2 configuration', () => {
    expect(validate(productionConfig).NODE_ENV).toBe('production');
  });

  it('rejects weak JWT secrets', () => {
    expect(() => validate({ ...productionConfig, JWT_SECRET: 'weak' })).toThrow(
      'JWT_SECRET must contain at least 32 characters',
    );
  });

  it('rejects non-HTTPS CORS origins', () => {
    expect(() =>
      validate({ ...productionConfig, CORS_ORIGIN: 'http://example.com' }),
    ).toThrow('CORS_ORIGIN must be an HTTPS origin');
  });

  it('rejects PostgreSQL connections without SSL', () => {
    expect(() =>
      validate({
        ...productionConfig,
        DATABASE_URL: 'postgresql://user:password@host.example/db',
      }),
    ).toThrow(
      'DATABASE_URL must use PostgreSQL with sslmode=require or verify-full',
    );
  });

  it('rejects local file storage in production', () => {
    expect(() =>
      validate({ ...productionConfig, STORAGE_DRIVER: 'local' }),
    ).toThrow('STORAGE_DRIVER must be r2 in production');
  });

  it('accepts SMTP configuration for report confirmations', () => {
    expect(
      validate({
        ...productionConfig,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_USER: 'mailer',
        SMTP_PASSWORD: 'mail-secret',
        SMTP_FROM: 'reports@example.com',
      }).SMTP_HOST,
    ).toBe('smtp.example.com');
  });

  it('rejects partial SMTP configuration', () => {
    expect(() =>
      validate({ ...productionConfig, SMTP_HOST: 'smtp.example.com' }),
    ).toThrow('SMTP_HOST, SMTP_PORT and SMTP_FROM must be configured together');
  });

  it('requires SMTP credentials to be configured as a pair', () => {
    expect(() =>
      validate({
        ...productionConfig,
        SMTP_HOST: 'smtp.example.com',
        SMTP_PORT: '587',
        SMTP_FROM: 'reports@example.com',
        SMTP_USER: 'mailer',
      }),
    ).toThrow('SMTP_USER and SMTP_PASSWORD must be configured together');
  });
});
