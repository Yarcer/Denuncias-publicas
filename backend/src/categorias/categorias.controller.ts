import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { CategoriasService } from './categorias.service';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';

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
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPERADMINISTRADOR')
  create(@Body() dto: CreateCategoryDto) {
    return this.categoriasService.create(dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPERADMINISTRADOR')
  update(@Param('id') id: string, @Body() dto: UpdateCategoryDto) {
    return this.categoriasService.update(id, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPERADMINISTRADOR')
  remove(@Param('id') id: string) {
    return this.categoriasService.remove(id);
  }
}
