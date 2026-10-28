import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { DenunciasController } from './denuncias.controller';
import { DenunciasService } from './denuncias.service';
import { ConfirmationMailService } from './confirmation-mail.service';
import { EvidenceStorageService } from './evidence-storage.service';

@Module({
  controllers: [DenunciasController],
  providers: [
    DenunciasService,
    RolesGuard,
    EvidenceStorageService,
    ConfirmationMailService,
  ],
})
export class DenunciasModule {}
