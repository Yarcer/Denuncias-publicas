import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import type { Request } from 'express';
import {
  CreateAdministrativeUserDto,
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

}
