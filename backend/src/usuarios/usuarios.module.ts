import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { RolesGuard } from '../common/guards/roles.guard';

@Module({
  controllers: [UsuariosController],
  providers: [UsuariosService, RolesGuard],
})
export class UsuariosModule {}
