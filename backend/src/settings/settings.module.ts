import {
  BadRequestException,
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Global,
  Injectable,
  Module,
  NotFoundException,
  Param,
  Put,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IsBoolean, IsObject, IsOptional } from 'class-validator';
import { AuthUser } from '../common/auth-user';
import { Roles } from '../common/decorators';
import { MODULE_CATALOG, MODULE_KEYS, ModuleKey, REQUIRE_MODULE } from '../common/modules';
import { PrismaService } from '../prisma/prisma.service';

export interface EffectiveSettings {
  modules: Record<string, boolean>;
  showIntranetOnLogin: boolean;
}

class GlobalSettingsDto {
  @IsOptional() @IsBoolean() showIntranetOnLogin?: boolean;
  @IsOptional() @IsBoolean() emailEnabled?: boolean;
  @IsOptional() @IsObject() modules?: Record<string, boolean>;
}

class CompanySettingsDto {
  /** null = heredar del holding */
  @IsOptional() @IsBoolean() showIntranetOverride?: boolean | null;
  /** { modulo: true | false | null }; null = heredar */
  @IsOptional() @IsObject() moduleOverrides?: Record<string, boolean | null>;
}

const TTL_MS = 10_000;

const asBoolMap = (v: unknown): Record<string, boolean> => {
  const out: Record<string, boolean> = {};
  if (v && typeof v === 'object') for (const [k, val] of Object.entries(v)) if (MODULE_KEYS.includes(k) && typeof val === 'boolean') out[k] = val;
  return out;
};

@Injectable()
export class SettingsService {
  private cache = new Map<string, { at: number; value: EffectiveSettings }>();

  constructor(private prisma: PrismaService) {}

  private async globalRow() {
    return this.prisma.appSetting.upsert({ where: { id: 'global' }, update: {}, create: { id: 'global' } });
  }

  /** Configuración que le aplica a una empresa (o al holding si no hay empresa): anulaciones de la empresa sobre lo global */
  async effective(companyId: string | null): Promise<EffectiveSettings> {
    const key = companyId || 'global';
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < TTL_MS) return hit.value;

    const g = await this.globalRow();
    const company = companyId
      ? await this.prisma.company.findUnique({ where: { id: companyId }, select: { showIntranetOverride: true, moduleOverrides: true } })
      : null;
    const globalMods = asBoolMap(g.modules);
    const overrides = asBoolMap(company?.moduleOverrides);
    const modules: Record<string, boolean> = {};
    for (const k of MODULE_KEYS) modules[k] = overrides[k] ?? globalMods[k] ?? true;
    const value = { modules, showIntranetOnLogin: company?.showIntranetOverride ?? g.showIntranetOnLogin };
    this.cache.set(key, { at: Date.now(), value });
    return value;
  }

  /** El superadministrador se rige por la configuración del holding */
  forUser(u: Pick<AuthUser, 'role' | 'companyId'>) {
    return this.effective(u.role === 'SUPER_ADMIN' ? null : u.companyId);
  }

  async isEnabled(u: Pick<AuthUser, 'role' | 'companyId'>, key: ModuleKey) {
    return (await this.forUser(u)).modules[key] !== false;
  }

  async overview() {
    const [g, companies] = await Promise.all([
      this.globalRow(),
      this.prisma.company.findMany({
        orderBy: { name: 'asc' },
        select: { id: true, name: true, slug: true, primaryColor: true, active: true, showIntranetOverride: true, moduleOverrides: true },
      }),
    ]);
    return {
      catalog: MODULE_CATALOG,
      global: { showIntranetOnLogin: g.showIntranetOnLogin, emailEnabled: g.emailEnabled, modules: { ...Object.fromEntries(MODULE_KEYS.map((k) => [k, true])), ...asBoolMap(g.modules) } },
      companies: companies.map((c) => ({ ...c, moduleOverrides: asBoolMap(c.moduleOverrides) })),
    };
  }

  async updateGlobal(dto: GlobalSettingsDto) {
    const g = await this.globalRow();
    const modules = { ...asBoolMap(g.modules), ...asBoolMap(dto.modules) };
    await this.prisma.appSetting.update({
      where: { id: 'global' },
      data: {
        modules,
        ...(dto.showIntranetOnLogin !== undefined ? { showIntranetOnLogin: dto.showIntranetOnLogin } : {}),
        ...(dto.emailEnabled !== undefined ? { emailEnabled: dto.emailEnabled } : {}),
      },
    });
    this.cache.clear();
    return this.overview();
  }

  async updateCompany(id: string, dto: CompanySettingsDto) {
    const c = await this.prisma.company.findUnique({ where: { id }, select: { moduleOverrides: true } });
    if (!c) throw new NotFoundException('Empresa no encontrada');
    const bad = Object.keys(dto.moduleOverrides || {}).find((k) => !MODULE_KEYS.includes(k));
    if (bad) throw new BadRequestException(`Módulo desconocido: ${bad}`);
    const moduleOverrides = asBoolMap(c.moduleOverrides);
    for (const [k, v] of Object.entries(dto.moduleOverrides || {})) {
      if (v === null) delete moduleOverrides[k];
      else if (typeof v === 'boolean') moduleOverrides[k] = v;
    }
    await this.prisma.company.update({
      where: { id },
      data: { moduleOverrides, ...(dto.showIntranetOverride !== undefined ? { showIntranetOverride: dto.showIntranetOverride } : {}) },
    });
    this.cache.clear();
    return this.overview();
  }
}

/** Guard global: aplica @RequireModule() según la configuración de la empresa del usuario */
@Injectable()
export class ModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private settings: SettingsService,
  ) {}
  async canActivate(ctx: ExecutionContext) {
    const key = this.reflector.getAllAndOverride<ModuleKey | undefined>(REQUIRE_MODULE, [ctx.getHandler(), ctx.getClass()]);
    if (!key) return true;
    const user: AuthUser | undefined = ctx.switchToHttp().getRequest().user;
    if (!user) return true;
    if (!(await this.settings.isEnabled(user, key))) throw new ForbiddenException('Este módulo no está habilitado para tu empresa');
    return true;
  }
}

@Roles('SUPER_ADMIN')
@Controller('settings')
export class SettingsController {
  constructor(private svc: SettingsService) {}

  @Get()
  overview() {
    return this.svc.overview();
  }

  @Put('global')
  updateGlobal(@Body() dto: GlobalSettingsDto) {
    return this.svc.updateGlobal(dto);
  }

  @Put('companies/:id')
  updateCompany(@Param('id') id: string, @Body() dto: CompanySettingsDto) {
    return this.svc.updateCompany(id, dto);
  }
}

@Global()
@Module({ controllers: [SettingsController], providers: [SettingsService], exports: [SettingsService] })
export class SettingsModule {}
