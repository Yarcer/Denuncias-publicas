import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.usuariosService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.usuariosService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() body: Record<string, unknown>) {
    return this.usuariosService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.usuariosService.update(id, body);
  }
}
