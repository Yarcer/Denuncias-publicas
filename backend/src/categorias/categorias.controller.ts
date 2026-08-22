import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CategoriasService } from './categorias.service';

@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categoriasService: CategoriasService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll() {
    return this.categoriasService.findAll();
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.categoriasService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() body: Record<string, unknown>) {
    return this.categoriasService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.categoriasService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
