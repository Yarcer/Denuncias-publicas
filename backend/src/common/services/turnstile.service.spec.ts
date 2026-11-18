import {
  BadRequestException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TurnstileService } from './turnstile.service';

describe('TurnstileService', () => {
  const config = {
    'turnstile.secretKey': 'test-secret',
    nodeEnv: 'development',
    'cors.origin': 'http://localhost:5173',
  };
  let service: TurnstileService;

  beforeEach(() => {
    config.nodeEnv = 'development';
    config['turnstile.secretKey'] = 'test-secret';
    service = new TurnstileService({
      get: (key: string) => config[key as keyof typeof config],
    } as ConfigService);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('rejects a missing token without calling Cloudflare', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch');

    await expect(service.verify(undefined, 'register')).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('fails closed when the secret key is missing', async () => {
    config['turnstile.secretKey'] = '';

    await expect(
      service.verify('valid-token', 'register'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('rejects a token that Cloudflare does not accept', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(JSON.stringify({ success: false }), { status: 200 }),
      );

    await expect(
      service.verify('invalid-token', 'register'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a valid token issued for another action', async () => {
    jest
      .spyOn(global, 'fetch')
      .mockResolvedValue(
        new Response(
          JSON.stringify({ success: true, action: 'anonymous_login' }),
          { status: 200 },
        ),
      );

    await expect(
      service.verify('valid-token', 'register'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts Cloudflare test-key responses without action in development', async () => {
    config['turnstile.secretKey'] = '1x0000000000000000000000000000000AA';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          hostname: 'example.com',
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.verify('XXXX.DUMMY.TOKEN.XXXX', 'register'),
    ).resolves.toBeUndefined();
  });

  it('checks the hostname in production', async () => {
    config.nodeEnv = 'production';
    jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          action: 'register',
          hostname: 'other.example',
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.verify('valid-token', 'register'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('includes the client IP and accepts a matching verification', async () => {
    const fetchSpy = jest.spyOn(global, 'fetch').mockResolvedValue(
      new Response(
        JSON.stringify({
          success: true,
          action: 'register',
          hostname: 'localhost',
        }),
        { status: 200 },
      ),
    );

    await expect(
      service.verify('valid-token', 'register', '203.0.113.1'),
    ).resolves.toBeUndefined();

    const request = fetchSpy.mock.calls[0]?.[1];
    const body = new URLSearchParams(request?.body as string);
    expect(body.get('secret')).toBe('test-secret');
    expect(body.get('response')).toBe('valid-token');
    expect(body.get('remoteip')).toBe('203.0.113.1');
  });

  it('fails closed when Cloudflare cannot be reached', async () => {
    jest.spyOn(global, 'fetch').mockRejectedValue(new Error('network error'));

    await expect(
      service.verify('valid-token', 'register'),
    ).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
