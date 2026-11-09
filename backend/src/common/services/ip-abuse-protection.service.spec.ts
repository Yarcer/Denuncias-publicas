import { ConfigService } from '@nestjs/config';
import { IpAbuseProtectionService } from './ip-abuse-protection.service';

describe('IpAbuseProtectionService', () => {
  const service = new IpAbuseProtectionService({
    get: jest.fn().mockReturnValue('a-secret-long-enough-for-hmac-tests'),
  } as unknown as ConfigService);

  it('groups IPv6 addresses by their /64 prefix', () => {
    expect(service.hashIpAddress('2001:db8:abcd:12::1')).toBe(
      service.hashIpAddress('2001:db8:abcd:12:ffff::9'),
    );
  });

  it('keeps different IPv4 addresses separate', () => {
    expect(service.hashIpAddress('203.0.113.1')).not.toBe(
      service.hashIpAddress('203.0.113.2'),
    );
  });
});
