import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { Request } from 'express';
import {
  CreateAdministrativeUserDto,
  UpdateAdministrativeUserDto,
  UpdateAdministrativeUserStatusDto,
} from './dto/administrative-user.dto';
import { UsuariosService } from './usuarios.service';

type AuthenticatedRequest = Request & {
  user: { sub: string; role: string };
};

@Controller('usuarios')

@UseGuards(AuthGuard('jwt'), RolesGuard)
@Roles('SUPERADMINISTRADOR')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get('administrativos')
  findAdministrativeUsers(@Req() req: AuthenticatedRequest) {
    return this.usuariosService.findAdministrativeUsers(req.user);
  }

  @Post('administrativos')
  createAdministrativeUser(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateAdministrativeUserDto,
  ) {
    return this.usuariosService.createAdministrativeUser(req.user, dto);
  }

  @Patch(':id/estado')
  updateAdministrativeUserStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdministrativeUserStatusDto,
  ) {
    return this.usuariosService.updateAdministrativeUserStatus(req.user, id, dto);
  }

  @Patch(':id')
  updateAdministrativeUser(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateAdministrativeUserDto,
  ) {
    return this.usuariosService.updateAdministrativeUser(req.user, id, dto);
  }
}
