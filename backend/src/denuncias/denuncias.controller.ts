import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, Res, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { Public } from '../auth/decorators/public.decorator';
import { ConfirmationMailService } from './confirmation-mail.service';
import { DenunciasService } from './denuncias.service';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { AssignReportDto, ManageReportDto } from './dto/manage-report.dto';

type AuthenticatedRequest = Request & {
  user: { sub: string; role: string; email?: string };
};

@Controller('denuncias')
export class DenunciasController {
  constructor(
    private readonly denunciasService: DenunciasService,
    private readonly confirmationMailService: ConfirmationMailService,
  ) {}

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.denunciasService.findAll(req.user, status);
  }

  @Get('gestion/bandeja')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  managementQueue(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.denunciasService.managementQueue(req.user, status);
  }

  @Get('gestion/funcionarios')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  assignableUsers(@Req() req: AuthenticatedRequest) {
    return this.denunciasService.assignableUsers(req.user);
  }

  @Get('gestion/indicadores')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ADMINISTRADOR')
  indicators(@Req() req: AuthenticatedRequest) {
    return this.denunciasService.indicators(req.user);
  }

  @Get(':id/evidencia/:evidenceId')
  @UseGuards(AuthGuard('jwt'))
  async getEvidence(
    @Req() req: AuthenticatedRequest,
    @Res() res: Response,
    @Param('id') id: string,
    @Param('evidenceId') evidenceId: string,
  ) {
    const image = await this.denunciasService.getEvidence(
      id,
      evidenceId,
      req.user,
    );

    res.type(image.type).send(image.buffer);
  }
  
  @Get(':id')
  @UseGuards(AuthGuard('jwt'))
  findOne(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.findOne(id, req.user);
  }

  @Post()
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  @Throttle({ default: { limit: 5, ttl: 60 * 1000 } })
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    const report = await this.denunciasService.create(req.user.sub, dto);
    const confirmationEmailStatus = req.user.email
      ? await this.confirmationMailService.sendReportConfirmation({
          email: req.user.email,
          reportId: report.id,
          title: report.title,
        })
      : 'skipped';

    return { ...report, confirmationEmailStatus };
  }

    @Post(':id/evidencia')
    @UseGuards(AuthGuard('jwt'), RolesGuard)
    @Roles('CIUDADANO')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.denunciasService.uploadEvidence(id, req.user, file);
  }

  @Patch(':id/archivar')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  archive(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.denunciasService.archive(id, req.user);
  }

  @Post(':id/tomar')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  take(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.take(id, req.user);
  }

  @Patch(':id/asignar')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
  ) {
    return this.denunciasService.assign(id, req.user, dto);
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('ENTE_PUBLICO', 'ADMINISTRADOR')
  changeStatus(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: ManageReportDto) {
    return this.denunciasService.changeStatus(id, req.user, dto);
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  update(@Req() req: AuthenticatedRequest, @Param('id') id: string, @Body() dto: UpdateReportDto) {
    return this.denunciasService.update(id, req.user, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.remove(id, req.user);
  }
}
