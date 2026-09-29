import { GlobalRole } from '@prisma/client';

/** Usuario autenticado adjunto a cada petición (req.user) */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: GlobalRole;
  companyId: string | null;
  /** Áreas donde el usuario es líder */
  leaderAreaIds: string[];
  /** Áreas a las que pertenece (líder o colaborador) */
  areaIds: string[];
}

export const isSuper = (u: AuthUser) => u.role === 'SUPER_ADMIN';

/** El superadministrador actúa como líder de cualquier área */
export const isLeaderOf = (u: AuthUser, areaId: string) =>
  isSuper(u) || u.leaderAreaIds.includes(areaId);

export const canManageCompany = (u: AuthUser, companyId: string) =>
  isSuper(u) || (u.role === 'COMPANY_ADMIN' && u.companyId === companyId);
