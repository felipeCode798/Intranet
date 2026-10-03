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
  Query,
} from '@nestjs/common';
import { GlobalRole, Prisma } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsBoolean, IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { AuthUser, canManageCompany, isSuper } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { stripPassword } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

class CreateUserDto {
  @IsString() @MinLength(2) name: string;
  @IsEmail({}, { message: 'Correo inválido' }) email: string;
  @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) password: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'COMPANY_ADMIN', 'USER']) role?: GlobalRole;
}

class UpdateUserDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() companyId?: string;
  @IsOptional() @IsIn(['SUPER_ADMIN', 'COMPANY_ADMIN', 'USER']) role?: GlobalRole;
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) password?: string;
}

class ProfileDto {
  @IsOptional() @IsString() @MinLength(2) name?: string;
  @IsOptional() @IsString() jobTitle?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() avatarUrl?: string;
  @IsOptional() @IsString() currentPassword?: string;
  @IsOptional() @IsString() @MinLength(8, { message: 'La contraseña debe tener al menos 8 caracteres' }) newPassword?: string;
}

class TourDto {
  @IsString() @Matches(/^[a-z0-9-]{1,40}$/) key: string;
}

const LIST_INCLUDE = {
  company: { select: { id: true, name: true, primaryColor: true } },
  memberships: { include: { area: { select: { id: true, name: true, isShared: true } } } },
} satisfies Prisma.UserInclude;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async list(u: AuthUser, q: { companyId?: string; search?: string; areaId?: string }) {
    const where: Prisma.UserWhereInput = {};
    if (!isSuper(u)) {
      if (u.role !== 'COMPANY_ADMIN') throw new ForbiddenException();
      where.companyId = u.companyId;
    } else if (q.companyId) where.companyId = q.companyId;
    if (q.areaId) where.memberships = { some: { areaId: q.areaId } };
    if (q.search)
      where.OR = [
        { name: { contains: q.search, mode: 'insensitive' } },
        { email: { contains: q.search, mode: 'insensitive' } },
      ];
    const users = await this.prisma.user.findMany({ where, include: LIST_INCLUDE, orderBy: { name: 'asc' } });
    return users.map(stripPassword);
  }

  /** Directorio liviano para seleccionar personas (asignar, escalar, agregar a áreas) */
  directory(q: { areaId?: string; search?: string }) {
    return this.prisma.user.findMany({
      where: {
        active: true,
        ...(q.areaId ? { memberships: { some: { areaId: q.areaId } } } : {}),
        ...(q.search
          ? { OR: [{ name: { contains: q.search, mode: 'insensitive' } }, { email: { contains: q.search, mode: 'insensitive' } }] }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        jobTitle: true,
        avatarUrl: true,
        company: { select: { id: true, name: true, primaryColor: true } },
        memberships: { select: { role: true, area: { select: { id: true, name: true } } } },
      },
      orderBy: { name: 'asc' },
      take: 200,
    });
  }

  async create(u: AuthUser, dto: CreateUserDto) {
    const companyId = isSuper(u) ? dto.companyId : u.companyId;
    if (!isSuper(u) && (u.role !== 'COMPANY_ADMIN' || !companyId)) throw new ForbiddenException();
    if (!isSuper(u) && dto.role === 'SUPER_ADMIN') throw new ForbiddenException();
    const email = dto.email.toLowerCase().trim();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('Ese correo ya está registrado');
    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email,
        jobTitle: dto.jobTitle,
        phone: dto.phone,
        companyId,
        role: dto.role || 'USER',
        passwordHash: await bcrypt.hash(dto.password, 10),
      },
      include: LIST_INCLUDE,
    });
    return stripPassword(user);
  }

  async update(u: AuthUser, id: string, dto: UpdateUserDto) {
    const target = await this.prisma.user.findUnique({ where: { id } });
    if (!target) throw new NotFoundException();
    if (!isSuper(u) && !(target.companyId && canManageCompany(u, target.companyId))) throw new ForbiddenException();
    const { password, ...data } = dto;
    if (!isSuper(u)) {
      delete data.companyId;
      if (data.role === 'SUPER_ADMIN' || target.role === 'SUPER_ADMIN') throw new ForbiddenException();
    }
    const user = await this.prisma.user.update({
      where: { id },
      data: { ...data, ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
      include: LIST_INCLUDE,
    });
    return stripPassword(user);
  }

  async updateProfile(u: AuthUser, dto: ProfileDto) {
    const { currentPassword, newPassword, ...data } = dto;
    let passwordHash: string | undefined;
    if (newPassword) {
      const me = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id } });
      if (!currentPassword || !(await bcrypt.compare(currentPassword, me.passwordHash)))
        throw new BadRequestException('La contraseña actual no es correcta');
      passwordHash = await bcrypt.hash(newPassword, 10);
    }
    const user = await this.prisma.user.update({ where: { id: u.id }, data: { ...data, ...(passwordHash ? { passwordHash } : {}) } });
    return stripPassword(user);
  }

  /** Marca un recorrido guiado como visto para que no vuelva a abrirse solo */
  async markTourSeen(u: AuthUser, key: string) {
    const me = await this.prisma.user.findUniqueOrThrow({ where: { id: u.id }, select: { toursSeen: true } });
    if (me.toursSeen.includes(key)) return { toursSeen: me.toursSeen };
    return this.prisma.user.update({ where: { id: u.id }, data: { toursSeen: { push: key } }, select: { toursSeen: true } });
  }

  resetTours(u: AuthUser) {
    return this.prisma.user.update({ where: { id: u.id }, data: { toursSeen: [] }, select: { toursSeen: true } });
  }
}

@Controller('users')
export class UsersController {
  constructor(private svc: UsersService) {}

  @Get()
  list(@CurrentUser() u: AuthUser, @Query() q: { companyId?: string; search?: string; areaId?: string }) {
    return this.svc.list(u, q);
  }

  @Get('directory')
  directory(@Query() q: { areaId?: string; search?: string }) {
    return this.svc.directory(q);
  }

  @Post()
  create(@CurrentUser() u: AuthUser, @Body() dto: CreateUserDto) {
    return this.svc.create(u, dto);
  }

  @Patch('me')
  updateMe(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) {
    return this.svc.updateProfile(u, dto);
  }

  @Post('me/tours')
  markTourSeen(@CurrentUser() u: AuthUser, @Body() dto: TourDto) {
    return this.svc.markTourSeen(u, dto.key);
  }

  @Delete('me/tours')
  resetTours(@CurrentUser() u: AuthUser) {
    return this.svc.resetTours(u);
  }

  @Patch(':id')
  update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.svc.update(u, id, dto);
  }
}

@Module({ controllers: [UsersController], providers: [UsersService] })
export class UsersModule {}
