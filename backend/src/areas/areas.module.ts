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
import { AreaRole } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsOptional, IsString, MinLength } from 'class-validator';
import { AuthUser, canManageCompany, isLeaderOf, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { USER_PUBLIC } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

class AreaDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsBoolean() isShared?: boolean;
  @IsOptional() @IsBoolean() active?: boolean;
  /** Empresas a las que atiende el área */
  @IsOptional() @IsArray() @IsString({ each: true }) companyIds?: string[];
}

class MemberDto {
  @IsString() userId: string;
  @IsOptional() @IsIn(['LEADER', 'MEMBER']) role?: AreaRole;
}

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  list(companyId?: string) {
    return this.prisma.area.findMany({
      where: { active: true, ...(companyId ? { companies: { some: { companyId } } } : {}) },
      orderBy: [{ isShared: 'desc' }, { name: 'asc' }],
      include: {
        companies: { include: { company: { select: { id: true, name: true, primaryColor: true, slug: true } } } },
        members: { include: { user: { select: USER_PUBLIC } }, orderBy: { role: 'asc' } },
        _count: { select: { forms: true, requests: true } },
      },
    });
  }

  /** Áreas donde el usuario es líder o colaborador */
  mine(u: AuthUser) {
    return this.prisma.area.findMany({
      where: isSuper(u) ? { active: true } : { active: true, id: { in: u.areaIds } },
      orderBy: { name: 'asc' },
      include: {
        companies: { include: { company: { select: { id: true, name: true, primaryColor: true } } } },
        members: { include: { user: { select: USER_PUBLIC } } },
      },
    });
  }

  async create(u: AuthUser, dto: AreaDto) {
    if (!dto.name) throw new BadRequestException('El nombre del área es obligatorio');
    const companyIds = dto.companyIds || [];
    if (!companyIds.length) throw new BadRequestException('Selecciona al menos una empresa');
    // Un administrador de empresa solo crea áreas propias de su empresa
    if (!isSuper(u)) {
      if (dto.isShared || companyIds.some((c) => !canManageCompany(u, c)))
        throw new ForbiddenException('Solo el administrador del holding crea áreas compartidas');
    }
    return this.prisma.area.create({
      data: {
        name: dto.name,
        description: dto.description,
        icon: dto.icon || 'folder',
        isShared: !!dto.isShared || companyIds.length > 1,
        companies: { create: companyIds.map((companyId) => ({ companyId })) },
      },
    });
  }

  private async assertManage(u: AuthUser, areaId: string) {
    const area = await this.prisma.area.findUnique({ where: { id: areaId }, include: { companies: true } });
    if (!area) throw new NotFoundException('Área no encontrada');
    const admin = isSuper(u) || (!area.isShared && area.companies.some((c) => canManageCompany(u, c.companyId)));
    return { area, admin, leader: isLeaderOf(u, areaId) };
  }

  async update(u: AuthUser, id: string, dto: AreaDto) {
    const { admin } = await this.assertManage(u, id);
    if (!admin) throw new ForbiddenException('No puedes editar esta área');
    const { companyIds, ...data } = dto;
    if (!isSuper(u)) delete data.isShared;
    return this.prisma.$transaction(async (tx) => {
      if (companyIds && isSuper(u)) {
        await tx.areaCompany.deleteMany({ where: { areaId: id } });
        for (const companyId of companyIds) await tx.areaCompany.create({ data: { areaId: id, companyId } });
      }
      return tx.area.update({ where: { id }, data });
    });
  }

  async addMember(u: AuthUser, areaId: string, dto: MemberDto) {
    const { admin, leader } = await this.assertManage(u, areaId);
    const role = dto.role || 'MEMBER';
    // El líder puede sumar colaboradores; solo los administradores designan líderes
    if (!admin && !(leader && role === 'MEMBER')) throw new ForbiddenException('No puedes gestionar los miembros de esta área');
    return this.prisma.areaMember.upsert({
      where: { userId_areaId: { userId: dto.userId, areaId } },
      update: { role },
      create: { userId: dto.userId, areaId, role },
      include: { user: { select: USER_PUBLIC } },
    });
  }

  async removeMember(u: AuthUser, areaId: string, userId: string) {
    const { admin, leader } = await this.assertManage(u, areaId);
    const m = await this.prisma.areaMember.findUnique({ where: { userId_areaId: { userId, areaId } } });
    if (!m) throw new NotFoundException();
    if (!admin && !(leader && m.role === 'MEMBER')) throw new ForbiddenException();
    const open = await this.prisma.request.count({
      where: { areaId, assigneeId: userId, status: { in: ['ASSIGNED', 'IN_PROGRESS', 'ESCALATION_REQUESTED'] } },
    });
    if (open) throw new BadRequestException(`El colaborador tiene ${open} solicitud(es) abiertas en esta área. Reasígnalas primero.`);
    await this.prisma.areaMember.delete({ where: { id: m.id } });
    return { ok: true };
  }
}

@Controller('areas')
export class AreasController {
  constructor(private svc: AreasService) {}

  @Get()
  list(@Query('companyId') companyId?: string) {
    return this.svc.list(companyId);
  }

  @Get('mine')
  mine(@CurrentUser() u: AuthUser) {
    return this.svc.mine(u);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: AreaDto) {
    return this.svc.create(u, dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: AreaDto) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/members')
  addMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: MemberDto) {
    return this.svc.addMember(u, id, dto);
  }

  @Delete(':id/members/:userId')
  removeMember(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('userId') userId: string) {
    return this.svc.removeMember(u, id, userId);
  }
}

@Module({ controllers: [AreasController], providers: [AreasService] })
export class AreasModule {}
