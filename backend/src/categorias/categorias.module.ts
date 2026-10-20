import { Module } from '@nestjs/common';
import { CategoriasController } from './categorias.controller';
import { CategoriasService } from './categorias.service';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  controllers: [CategoriasController],
  providers: [CategoriasService, RolesGuard],
})
export class CategoriasModule {}
