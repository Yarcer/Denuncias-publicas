import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { AuthService } from './auth.service';

const cleanupIntervalMs = 60 * 60 * 1000;

@Injectable()
export class AnonymousAccountCleanupService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(AnonymousAccountCleanupService.name);
  private timer: NodeJS.Timeout | undefined;
  private initialTimer: NodeJS.Timeout | undefined;
  private running = false;

  constructor(private readonly authService: AuthService) {}

  onModuleInit() {
    this.initialTimer = setTimeout(() => {
      void this.runCleanup();
      this.timer = setInterval(() => void this.runCleanup(), cleanupIntervalMs);
      this.timer.unref();
    }, 60_000);
    this.initialTimer.unref();
  }

  onModuleDestroy() {
    if (this.initialTimer) clearTimeout(this.initialTimer);
    if (this.timer) clearInterval(this.timer);
  }

  private async runCleanup() {
    if (this.running) return;
    this.running = true;

    try {
      const result = await this.authService.cleanupExpiredAnonymousAccounts();
      if (
        result.deletedAccounts ||
        result.clearedAccountHashes ||
        result.clearedReportHashes
      ) {
        this.logger.log(
          `Limpieza anónima: ${result.deletedAccounts} cuentas eliminadas; ${result.clearedAccountHashes + result.clearedReportHashes} hashes de IP vencidos eliminados`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Error desconocido';
      this.logger.error(`No se pudo completar la limpieza anónima: ${message}`);
    } finally {
      this.running = false;
    }
  }
}
