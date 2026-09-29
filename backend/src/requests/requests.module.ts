import { Body, Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { NotifierService } from './notifier.service';
import { AssignDto, CommentDto, CreateRequestDto, EscalateDto, ListQuery, NoteDto, RespondDto, TransferDto } from './requests.dto';
import { RequestsService } from './requests.service';
import { SlaService } from './sla.service';

@Controller('requests')
export class RequestsController {
  constructor(
    private svc: RequestsService,
    private sla: SlaService,
  ) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: ListQuery) {
    return this.svc.list(u, q);
  }

  @Get('overview')
  overview(@CurrentUser() u: AuthUser) {
    return this.svc.overview(u);
  }

  /** Ejecuta manualmente la revisión de vencimientos (útil en pruebas) */
  @Roles('SUPER_ADMIN')
  @Post('sla/run')
  runSla() {
    return this.sla.run();
  }

  @Get(':id')
  detail(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.detail(u, id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateRequestDto) {
    return this.svc.create(u, dto);
  }

  @Post(':id/assign')
  assign(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.svc.assign(u, id, dto);
  }

  @Post(':id/accept')
  accept(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.accept(u, id);
  }

  @Post(':id/escalate')
  escalate(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: EscalateDto) {
    return this.svc.escalate(u, id, dto);
  }

  @Post(':id/reject-escalation')
  rejectEscalation(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.rejectEscalation(u, id, dto);
  }

  @Post(':id/reassign')
  reassign(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AssignDto) {
    return this.svc.reassign(u, id, dto);
  }

  @Post(':id/transfer')
  transfer(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: TransferDto) {
    return this.svc.transfer(u, id, dto);
  }

  @Post(':id/respond')
  respond(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: RespondDto) {
    return this.svc.respond(u, id, dto);
  }

  @Post(':id/comments')
  comment(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: CommentDto) {
    return this.svc.comment(u, id, dto);
  }

  @Post(':id/cancel')
  cancel(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: NoteDto) {
    return this.svc.cancel(u, id, dto);
  }
}

@Module({
  controllers: [RequestsController],
  providers: [RequestsService, NotifierService, SlaService],
})
export class RequestsModule {}
