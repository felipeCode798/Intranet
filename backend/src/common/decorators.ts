import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import { GlobalRole } from '@prisma/client';
import { AuthUser } from './auth-user';

export const IS_PUBLIC = 'isPublic';
/** Marca un endpoint como público (sin JWT) */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
/** Restringe un endpoint a ciertos roles globales */
export const Roles = (...roles: GlobalRole[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthUser => ctx.switchToHttp().getRequest().user,
);
