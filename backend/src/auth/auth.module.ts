import {
  Body,
  CanActivate,
  Controller,
  ExecutionContext,
  ForbiddenException,
  Get,
  Injectable,
  Module,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule, PassportStrategy } from '@nestjs/passport';
import { GlobalRole } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { IsEmail, IsString, MinLength } from 'class-validator';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthUser } from '../common/auth-user';
import { CurrentUser, IS_PUBLIC, Public, ROLES } from '../common/decorators';
import { stripPassword } from '../common/user-select';
import { PrismaService } from '../prisma/prisma.service';

class LoginDto {
  @IsEmail({}, { message: 'Correo inválido' })
  email: string;
  @IsString()
  @MinLength(1)
  password: string;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      throw new UnauthorizedException('Correo o contraseña incorrectos');
    }
    const token = await this.jwt.signAsync({ sub: user.id });
    return { token, user: await this.profile(user.id) };
  }

  async profile(id: string) {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: {
        company: {
          select: { id: true, name: true, slug: true, primaryColor: true, secondaryColor: true, logoUrl: true },
        },
        memberships: {
          include: { area: { select: { id: true, name: true, icon: true, isShared: true } } },
        },
      },
    });
    if (!u) throw new UnauthorizedException();
    return stripPassword(u);
  }

  /** Carga el usuario con sus membresías para construir el AuthUser */
  async toAuthUser(id: string): Promise<AuthUser | null> {
    const u = await this.prisma.user.findUnique({
      where: { id },
      include: { memberships: { where: { area: { active: true } } } },
    });
    if (!u || !u.active) return null;
    return {
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      companyId: u.companyId,
      areaIds: u.memberships.map((m) => m.areaId),
      leaderAreaIds: u.memberships.filter((m) => m.role === 'LEADER').map((m) => m.areaId),
    };
  }
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    config: ConfigService,
    private auth: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: config.get<string>('JWT_SECRET', 'dev-secret'),
    });
  }
  async validate(payload: { sub: string }) {
    const user = await this.auth.toAuthUser(payload.sub);
    if (!user) throw new UnauthorizedException('Sesión inválida');
    return user;
  }
}

/** Guard global: exige JWT salvo en endpoints @Public() */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }
  canActivate(ctx: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [ctx.getHandler(), ctx.getClass()]);
    return isPublic ? true : super.canActivate(ctx);
  }
}

/** Guard global: valida @Roles() */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}
  canActivate(ctx: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<GlobalRole[]>(ROLES, [ctx.getHandler(), ctx.getClass()]);
    if (!roles?.length) return true;
    const user: AuthUser = ctx.switchToHttp().getRequest().user;
    if (!user || !roles.includes(user.role)) throw new ForbiddenException('No tienes permisos para esta acción');
    return true;
  }
}

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Public()
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.email, dto.password);
  }

  @Get('me')
  me(@CurrentUser() u: AuthUser) {
    return this.auth.profile(u.id);
  }
}

@Module({
  imports: [
    PassportModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET', 'dev-secret'),
        signOptions: { expiresIn: config.get<string>('JWT_EXPIRES_IN', '12h') as any },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, JwtAuthGuard, RolesGuard],
  exports: [AuthService],
})
export class AuthModule {}
