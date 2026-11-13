import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '@nestjs/passport';
import type { Request, Response } from 'express';
import { Roles } from '../common/decorators/roles.decorator';
import { RolesGuard } from '../common/guards/roles.guard';
import { ConfirmationMailService } from './confirmation-mail.service';
import {
  DenunciasService,
  rejectionReasonLabels,
} from './denuncias.service';
import { CreateReportDto, UpdateReportDto } from './dto/report.dto';
import { AssignReportDto, ManageReportDto } from './dto/manage-report.dto';
import { Throttle } from '@nestjs/throttler';
import { ReportStatus } from '@prisma/client';

type AuthenticatedRequest = Request & {
  user: { sub: string; role: string; email?: string };
};

@Controller('denuncias')
export class DenunciasController {
  constructor(
    private readonly denunciasService: DenunciasService,
    private readonly confirmationMailService: ConfirmationMailService,
  ) { }

  @Get('public/mapa')
  @Header('Cache-Control', 'no-store')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  publicMap(@Query('subcategory') subcategory?: string) {
    return this.denunciasService.findPublicMap(subcategory);
  }

  @Get()
  @UseGuards(AuthGuard('jwt'))
  findAll(@Req() req: AuthenticatedRequest, @Query('status') status?: string) {
    return this.denunciasService.findAll(req.user, status);
  }

  @Get('gestion/bandeja')
  @UseGuards(AuthGuard('jwt'))
  managementQueue(
    @Req() req: AuthenticatedRequest,
    @Query('status') status?: string,
  ) {
    return this.denunciasService.managementQueue(req.user, status);
  }

  @Get('gestion/historial')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('FUNCIONARIO', 'FUNCIONARIO_ADMINISTRADOR')
  managementHistory(@Req() req: AuthenticatedRequest) {
    return this.denunciasService.managementHistory(req.user);
  }

  @Get('gestion/funcionarios')
  @UseGuards(AuthGuard('jwt'))
  assignableUsers(@Req() req: AuthenticatedRequest) {
    return this.denunciasService.assignableUsers(req.user);
  }

  @Get('gestion/estadisticas')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('SUPERADMINISTRADOR')
  statistics(
    @Req() req: AuthenticatedRequest,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.denunciasService.statistics(req.user, from, to);
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
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReportDto) {
    const report = await this.denunciasService.create(
      req.user.sub,
      dto,
      req.ip,
    );
    const emailConfirmation = req.user.email
      ? await this.confirmationMailService.sendReportConfirmation({
        email: req.user.email,
        reportId: report.id,
        title: report.title,
      })
      : 'skipped';

    return { ...report, emailConfirmation };
  }

  @Post(':id/evidencia')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  uploadEvidence(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @UploadedFile() file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    return this.denunciasService.uploadEvidence(id, req.user, file);
  }

  @Patch(':id/archivar')
  @UseGuards(AuthGuard('jwt'))
  archive(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.archive(id, req.user);
  }

  @Post(':id/tomar')
  @UseGuards(AuthGuard('jwt'))
  take(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.take(id, req.user);
  }

  @Patch(':id/asignar')
  @UseGuards(AuthGuard('jwt'))
  assign(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: AssignReportDto,
  ) {
    return this.denunciasService.assign(id, req.user, dto);
  }

  @Patch(':id/estado')
  @UseGuards(AuthGuard('jwt'))
  async changeStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ManageReportDto,
  ) {
    const report = await this.denunciasService.changeStatus(id, req.user, dto);

    if (
      dto.status === ReportStatus.RECHAZADO &&
      dto.rejectionReason &&
      report.reporter?.email
    ) {
      await this.confirmationMailService.sendReportRejectionNotice({
        email: report.reporter.email,
        reportId: report.id,
        title: report.title,
        reason: rejectionReasonLabels[dto.rejectionReason],
      });
    }

    return report;
  }

  @Patch(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateReportDto,
  ) {
    return this.denunciasService.update(id, req.user, dto);
  }

  @Delete(':id')
  @UseGuards(AuthGuard('jwt'), RolesGuard)
  @Roles('CIUDADANO')
  remove(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    return this.denunciasService.remove(id, req.user);
  }
}
