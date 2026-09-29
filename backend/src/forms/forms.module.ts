import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Priority } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { AuthUser, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';
import { sanitizeFields } from './form-field';

class FormDto {
  @IsOptional() @IsString() areaId?: string;
  @IsOptional() @IsString() @MinLength(3, { message: 'El nombre debe tener al menos 3 caracteres' }) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsInt() @Min(1, { message: 'El plazo mínimo es 1 día hábil' }) @Max(90) slaDays?: number;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) defaultPriority?: Priority;
  @IsOptional() @IsArray() fields?: unknown[];
  @IsOptional() @IsBoolean() active?: boolean;
}

@Injectable()
export class FormsService {
  constructor(private prisma: PrismaService) {}

  /** Si manage=true lista los formularios que el usuario puede editar (incluye inactivos) */
  list(u: AuthUser, q: { areaId?: string; manage?: string }) {
    const manage = q.manage === 'true';
    return this.prisma.requestForm.findMany({
      where: {
        ...(q.areaId ? { areaId: q.areaId } : {}),
        ...(manage ? (isSuper(u) ? {} : { areaId: { in: u.leaderAreaIds } }) : { active: true }),
      },
      orderBy: [{ area: { name: 'asc' } }, { name: 'asc' }],
      include: {
        area: { select: { id: true, name: true, icon: true, isShared: true } },
        _count: { select: { requests: true } },
      },
    });
  }

  async get(id: string) {
    const f = await this.prisma.requestForm.findUnique({
      where: { id },
      include: { area: { include: { companies: { include: { company: { select: { id: true, name: true } } } } } } },
    });
    if (!f) throw new NotFoundException('Formulario no encontrado');
    return f;
  }

  async create(u: AuthUser, dto: FormDto) {
    if (!dto.areaId || !dto.name) throw new BadRequestException('El área y el nombre son obligatorios');
    if (!isLeaderOf(u, dto.areaId)) throw new ForbiddenException('Solo el líder del área puede crear formularios');
    return this.prisma.requestForm.create({
      data: {
        areaId: dto.areaId,
        name: dto.name,
        description: dto.description,
        icon: dto.icon || 'file-text',
        slaDays: dto.slaDays ?? 5,
        defaultPriority: dto.defaultPriority || 'MEDIUM',
        fields: sanitizeFields(dto.fields || []) as any,
        active: dto.active ?? true,
      },
    });
  }

  async update(u: AuthUser, id: string, dto: FormDto) {
    const form = await this.get(id);
    if (!isLeaderOf(u, form.areaId)) throw new ForbiddenException('Solo el líder del área puede editar este formulario');
    const { areaId: _ignored, fields, ...data } = dto;
    return this.prisma.requestForm.update({
      where: { id },
      data: {
        ...data,
        ...(fields ? { fields: sanitizeFields(fields) as any, version: { increment: 1 } } : {}),
      },
    });
  }

  async duplicate(u: AuthUser, id: string) {
    const f = await this.get(id);
    if (!isLeaderOf(u, f.areaId)) throw new ForbiddenException();
    return this.prisma.requestForm.create({
      data: {
        areaId: f.areaId,
        name: `${f.name} (copia)`,
        description: f.description,
        icon: f.icon,
        slaDays: f.slaDays,
        defaultPriority: f.defaultPriority,
        fields: f.fields as any,
        active: false,
      },
    });
  }

  async remove(u: AuthUser, id: string) {
    const f = await this.get(id);
    if (!isLeaderOf(u, f.areaId)) throw new ForbiddenException();
    const used = await this.prisma.request.count({ where: { formId: id } });
    // Con solicitudes históricas solo se desactiva para conservar la trazabilidad
    if (used) {
      await this.prisma.requestForm.update({ where: { id }, data: { active: false } });
      return { ok: true, deactivated: true };
    }
    await this.prisma.requestForm.delete({ where: { id } });
    return { ok: true, deleted: true };
  }
}

@Controller('forms')
export class FormsController {
  constructor(private svc: FormsService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: { areaId?: string; manage?: string }) {
    return this.svc.list(u, q);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: FormDto) {
    return this.svc.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: FormDto) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/duplicate')
  duplicate(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.duplicate(u, id);
  }

  @Delete(':id')
  remove(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    return this.svc.remove(u, id);
  }
}

@Module({ controllers: [FormsController], providers: [FormsService] })
export class FormsModule {}
