import {
  BadRequestException,
  Body,
  ConflictException,
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
} from '@nestjs/common';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsHexColor,
  IsOptional,
  IsString,
  Matches,
  MinLength,
  ValidateNested,
} from 'class-validator';
import * as bcrypt from 'bcryptjs';
import { AuthUser, canManageCompany, isSuper } from '../common/auth-user';
import { CurrentUser, Roles } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

class CompanyContentDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9-]+$/, { message: 'El identificador solo admite minúsculas, números y guiones' }) slug?: string;
  @IsOptional() @IsString() legalName?: string;
  @IsOptional() @IsString() nit?: string;
  @IsOptional() @IsString() slogan?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsHexColor() primaryColor?: string;
  @IsOptional() @IsHexColor() secondaryColor?: string;
  @IsOptional() @IsString() logoUrl?: string;
  @IsOptional() @IsString() heroImageUrl?: string;
  @IsOptional() @IsString() missionText?: string;
  @IsOptional() @IsString() missionImageUrl?: string;
  @IsOptional() @IsString() visionText?: string;
  @IsOptional() @IsString() visionImageUrl?: string;
  @IsOptional() @IsString() objectivesText?: string;
  @IsOptional() @IsString() purposeText?: string;
  @IsOptional() @IsString() organigramUrl?: string;
  @IsOptional() @IsString() managementSystem?: string;
  @IsOptional() @IsString() contactEmail?: string;
  @IsOptional() @IsString() website?: string;
  @IsOptional() @IsArray() @IsString({ each: true }) announcements?: string[];
  @IsOptional() @IsArray() @IsString({ each: true }) values?: string[];
  @IsOptional() @IsBoolean() active?: boolean;
}

class NewAreaDto {
  @IsString() @MinLength(2) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() icon?: string;
  @IsOptional() @IsString() leaderId?: string;
}

class AdminUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) password: string;
  @IsOptional() @IsString() jobTitle?: string;
}

class CreateCompanyDto extends CompanyContentDto {
  @IsOptional() @IsArray() @IsString({ each: true }) sharedAreaIds?: string[];
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => NewAreaDto) newAreas?: NewAreaDto[];
  @IsOptional() @ValidateNested() @Type(() => AdminUserDto) admin?: AdminUserDto;
}

class UpdateCompanyDto extends CompanyContentDto {
  @IsOptional() @IsArray() @IsString({ each: true }) sharedAreaIds?: string[];
}

class DocumentDto {
  @IsString() @MinLength(2) title: string;
  @IsString() url: string;
  @IsOptional() @IsString() category?: string;
  @IsOptional() @IsString() process?: string;
  @IsOptional() @IsBoolean() featured?: boolean;
}

const pickContent = (dto: CompanyContentDto) => {
  const { sharedAreaIds, newAreas, admin, ...rest } = dto as any;
  return rest;
};

@Injectable()
export class CompaniesService {
  constructor(private prisma: PrismaService) {}

  list(includeInactive: boolean) {
    return this.prisma.company.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: { name: 'asc' },
      include: { _count: { select: { users: true, areas: true, requests: true } } },
    });
  }

  async bySlug(slug: string) {
    const c = await this.prisma.company.findUnique({
      where: { slug },
      include: {
        areas: {
          where: { area: { active: true } },
          include: {
            area: {
              include: {
                forms: { where: { active: true }, select: { id: true, name: true, description: true, icon: true, slaDays: true } },
                members: { where: { role: 'LEADER' }, include: { user: { select: { id: true, name: true, email: true } } } },
              },
            },
          },
        },
        documents: { orderBy: [{ featured: 'desc' }, { createdAt: 'desc' }] },
      },
    });
    if (!c || !c.active) throw new NotFoundException('Intranet no encontrada');
    const { areas, ...rest } = c;
    return {
      ...rest,
      areas: areas
        .map((ac) => ({ ...ac.area, leaders: ac.area.members.map((m) => m.user), members: undefined }))
        .sort((a, b) => Number(a.isShared) - Number(b.isShared) || a.name.localeCompare(b.name)),
    };
  }

  async get(id: string) {
    const c = await this.prisma.company.findUnique({
      where: { id },
      include: { areas: { include: { area: true } }, documents: true },
    });
    if (!c) throw new NotFoundException('Empresa no encontrada');
    return c;
  }

  async create(dto: CreateCompanyDto) {
    const slug = dto.slug!.toLowerCase();
    if (await this.prisma.company.findUnique({ where: { slug } })) throw new ConflictException('Ya existe una intranet con ese identificador');
    if (dto.admin && (await this.prisma.user.findUnique({ where: { email: dto.admin.email.toLowerCase() } })))
      throw new ConflictException('El correo del administrador ya está registrado');

    const shared = dto.sharedAreaIds?.length
      ? await this.prisma.area.findMany({ where: { id: { in: dto.sharedAreaIds }, isShared: true } })
      : [];

    return this.prisma.$transaction(async (tx) => {
      const company = await tx.company.create({ data: { ...pickContent(dto), slug } });
      for (const a of shared) await tx.areaCompany.create({ data: { areaId: a.id, companyId: company.id } });
      for (const na of dto.newAreas || []) {
        const area = await tx.area.create({
          data: {
            name: na.name,
            description: na.description,
            icon: na.icon || 'folder',
            companies: { create: { companyId: company.id } },
          },
        });
        if (na.leaderId) await tx.areaMember.create({ data: { areaId: area.id, userId: na.leaderId, role: 'LEADER' } });
      }
      if (dto.admin) {
        await tx.user.create({
          data: {
            name: dto.admin.name,
            email: dto.admin.email.toLowerCase(),
            jobTitle: dto.admin.jobTitle || 'Administrador de intranet',
            passwordHash: await bcrypt.hash(dto.admin.password, 10),
            role: 'COMPANY_ADMIN',
            companyId: company.id,
          },
        });
      }
      return company;
    });
  }

  async update(u: AuthUser, id: string, dto: UpdateCompanyDto) {
    if (!canManageCompany(u, id)) throw new ForbiddenException('No puedes editar esta empresa');
    const data = pickContent(dto);
    if (data.slug) {
      data.slug = data.slug.toLowerCase();
      const other = await this.prisma.company.findUnique({ where: { slug: data.slug } });
      if (other && other.id !== id) throw new ConflictException('Ya existe una intranet con ese identificador');
    }
    if (!isSuper(u)) delete data.active;
    return this.prisma.$transaction(async (tx) => {
      if (dto.sharedAreaIds && isSuper(u)) {
        const shared = await tx.area.findMany({ where: { isShared: true }, select: { id: true } });
        const sharedIds = shared.map((a) => a.id);
        await tx.areaCompany.deleteMany({ where: { companyId: id, areaId: { in: sharedIds } } });
        for (const areaId of dto.sharedAreaIds.filter((x) => sharedIds.includes(x)))
          await tx.areaCompany.create({ data: { areaId, companyId: id } });
      }
      return tx.company.update({ where: { id }, data });
    });
  }

  // ---- Documentos de la intranet ----
  async addDocument(u: AuthUser, companyId: string, dto: DocumentDto) {
    if (!canManageCompany(u, companyId)) throw new ForbiddenException();
    return this.prisma.document.create({ data: { ...dto, companyId, category: dto.category || 'documentos' } });
  }

  async updateDocument(u: AuthUser, id: string, dto: Partial<DocumentDto>) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    if (!canManageCompany(u, doc.companyId)) throw new ForbiddenException();
    return this.prisma.document.update({ where: { id }, data: dto });
  }

  async removeDocument(u: AuthUser, id: string) {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc) throw new NotFoundException();
    if (!canManageCompany(u, doc.companyId)) throw new ForbiddenException();
    await this.prisma.document.delete({ where: { id } });
    return { ok: true };
  }
}

@Controller('companies')
export class CompaniesController {
  constructor(private svc: CompaniesService) {}

  @Get()
  list(@CurrentUser() u: AuthUser) {
    return this.svc.list(isSuper(u));
  }

  @Get('by-slug/:slug')
  bySlug(@Param('slug') slug: string) {
    return this.svc.bySlug(slug);
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Roles('SUPER_ADMIN')
  @Post()
  create(@Body() dto: CreateCompanyDto) {
    if (!dto.name || !dto.slug) throw new BadRequestException('El nombre y el identificador de la intranet son obligatorios');
    return this.svc.create(dto);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateCompanyDto) {
    return this.svc.update(u, id, dto);
  }

  @Post(':id/documents')
  addDoc(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: DocumentDto) {
    return this.svc.addDocument(u, id, dto);
  }

  @Patch('documents/:docId')
  updateDoc(@CurrentUser() u: AuthUser, @Param('docId') docId: string, @Body() dto: DocumentDto) {
    return this.svc.updateDocument(u, docId, dto);
  }

  @Delete('documents/:docId')
  removeDoc(@CurrentUser() u: AuthUser, @Param('docId') docId: string) {
    return this.svc.removeDocument(u, docId);
  }
}

@Module({ controllers: [CompaniesController], providers: [CompaniesService] })
export class CompaniesModule {}
