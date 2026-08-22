import { Module } from '@nestjs/common';
import { DenunciasController } from './denuncias.controller';
import { DenunciasService } from './denuncias.service';

@Module({
  controllers: [DenunciasController],
  providers: [DenunciasService],
})
export class DenunciasModule {}
