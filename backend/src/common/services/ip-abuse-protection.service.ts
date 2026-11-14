import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac } from 'node:crypto';
import { isIP } from 'node:net';

function normalizeIpAddress(ipAddress: string) {
  const version = isIP(ipAddress);
  if (version === 4) return `ipv4:${ipAddress}`;
  if (version !== 6) {
    throw new ServiceUnavailableException(
      'No se pudo determinar una dirección IP válida',
    );
  }

  const normalized = ipAddress.toLowerCase().split('%')[0];
  const [left = '', right = ''] = normalized.split('::');
  const expandIpv4 = (part: string) => {
    if (!part.includes('.')) return [part];
    const octets = part.split('.').map(Number);
    return [
      ((octets[0] << 8) | octets[1]).toString(16),
      ((octets[2] << 8) | octets[3]).toString(16),
    ];
  };
  const leftParts = left ? left.split(':').flatMap(expandIpv4) : [];
  const rightParts = right ? right.split(':').flatMap(expandIpv4) : [];
  const groups =
    leftParts.length + rightParts.length < 8
      ? [
          ...leftParts,
          ...Array.from(
            { length: 8 - leftParts.length - rightParts.length },
            () => '0',
          ),
          ...rightParts,
        ]
      : [...leftParts, ...rightParts];
  const words = groups.map((group) => Number.parseInt(group || '0', 16));

  if (
    words.length === 8 &&
    words.slice(0, 5).every((word) => word === 0) &&
    words[5] === 0xffff
  ) {
    return `ipv4:${words[6] >> 8}.${words[6] & 255}.${words[7] >> 8}.${words[7] & 255}`;
  }

  return `ipv6:${words
    .slice(0, 4)
    .map((word) => word.toString(16))
    .join(':')}/64`;
}

@Injectable()
export class IpAbuseProtectionService {
  constructor(private readonly configService: ConfigService) {}

  hashIpAddress(ipAddress: string | undefined) {
    if (!ipAddress) {
      throw new ServiceUnavailableException(
        'No se pudo determinar la dirección de origen',
      );
    }

    const secret = this.configService.get<string>('ipHashSecret');
    if (!secret || secret.length < 32) {
      throw new ServiceUnavailableException(
        'La protección de límites por IP no está configurada',
      );
    }

    return createHmac('sha256', secret)
      .update(normalizeIpAddress(ipAddress))
      .digest('hex');
  }

  async acquireIpLock(
    transaction: Prisma.TransactionClient,
    scope: string,
    ipHash: string,
  ) {
    const lockKey = `${scope}:${ipHash}`;
    await transaction.$queryRaw(
      Prisma.sql`
        WITH ip_lock AS (
          SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))
        )
        SELECT 1 FROM ip_lock
      `,
    );
  }
}
