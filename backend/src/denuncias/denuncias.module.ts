import { Module } from '@nestjs/common';
import { RolesGuard } from '../common/guards/roles.guard';
import { DenunciasController } from './denuncias.controller';
import { DenunciasService } from './denuncias.service';

@Module({
  controllers: [DenunciasController],
  providers: [DenunciasService, RolesGuard],
})
export class DenunciasModule {}
