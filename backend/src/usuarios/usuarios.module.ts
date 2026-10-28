import { Module } from '@nestjs/common';
import { UsuariosController } from './usuarios.controller';
import { UsuariosService } from './usuarios.service';
import { RolesGuard } from '../common/guards/roles.guard';
import { SolicitudesUsuariosService } from './solicitudes-usuarios/solicitudes-usuarios.service';
import { SolicitudesUsuariosController } from './solicitudes-usuarios/solicitudes-usuarios.controller';

@Module({
  controllers: [UsuariosController, SolicitudesUsuariosController],
  providers: [UsuariosService, RolesGuard, SolicitudesUsuariosService],
})
export class UsuariosModule {}
