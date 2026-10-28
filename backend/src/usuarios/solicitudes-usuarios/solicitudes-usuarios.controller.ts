import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';

import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { SolicitudesUsuariosService } from './solicitudes-usuarios.service';
import { CreateSolicitudUsuarioDto } from './create-solicitud-usuario.dto';

type AuthenticatedRequest = Request & {
  user: {
    sub: string;
    role: string;
  };
};

@Controller('solicitudes-usuarios')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SolicitudesUsuariosController {
  constructor(
    private readonly solicitudesService: SolicitudesUsuariosService,
  ) {}

  @Post()
  @Roles('FUNCIONARIO_ADMINISTRADOR')
  crearSolicitud(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateSolicitudUsuarioDto,
  ) {
    return this.solicitudesService.crearSolicitud(req.user.sub, dto);
  }
}
