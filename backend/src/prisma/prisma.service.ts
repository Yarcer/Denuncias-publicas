import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      adapter: new PrismaPg({
        connectionString: process.env.DATABASE_URL ?? '',
      }),
    });
  }

  async onModuleInit() {
    try {
      await this.$connect();
    } catch (error) {
      this.logger.warn(
        'PostgreSQL no está disponible. La API básica seguirá iniciando.',
      );
    }
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
