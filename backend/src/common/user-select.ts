import { Prisma } from '@prisma/client';

/** Campos públicos de un usuario (nunca exponer passwordHash) */
export const USER_PUBLIC = {
  id: true,
  name: true,
  email: true,
  jobTitle: true,
  avatarUrl: true,
  companyId: true,
} satisfies Prisma.UserSelect;

export function stripPassword<T extends { passwordHash?: string }>(u: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _omit, ...rest } = u;
  return rest;
}
