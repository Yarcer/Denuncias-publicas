import { Controller, Get, Param, Post, Body, Patch, Delete, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Public } from '../auth/decorators/public.decorator';
import { DenunciasService } from './denuncias.service';

@Controller('denuncias')
export class DenunciasController {
  constructor(private readonly denunciasService: DenunciasService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Query('status') status?: string) {
    return this.denunciasService.findAll(status);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Param('id') id: string) {
    return this.denunciasService.findOne(id);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Body() body: Record<string, unknown>) {
    return this.denunciasService.create(body);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.denunciasService.update(id, body);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Param('id') id: string) {
    return this.denunciasService.remove(id);
  }
}
