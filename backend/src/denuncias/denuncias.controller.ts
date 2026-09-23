import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { Public } from '../auth/decorators/public.decorator';
import { DenunciasService } from './denuncias.service';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { ManageReportDto } from './dto/manage-report.dto';

type AuthenticatedRequest = Request & {
  user: { sub: string; role: string };
};

@Controller('denuncias')
export class DenunciasController {
  constructor(private readonly denunciasService: DenunciasService) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.denunciasService.findAll(req.user, status);
  }

  @Get('gestion/bandeja')
  @UseGuards(AuthGuard('jwt'))
  managementQueue(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.denunciasService.managementQueue(req.user, status);
  }

  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.findOne(id, req.user);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'))
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    return this.denunciasService.create(req.user.sub, dto);
  }

    @Post(':id/evidencia')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.denunciasService.uploadEvidence(id, req.user, file);
  }

  @Post(':id/tomar')
  @UseGuards(AuthGuard('jwt'))
  take(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.take(id, req.user);
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard('jwt'))
  changeStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ManageReportDto) {
    return this.denunciasService.changeStatus(id, req.user, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'))
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.denunciasService.update(id, req.user, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'))
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.remove(id, req.user);
  }
}
