import { SetMetadata } from '@nestjs/common';

/**
 * Módulos que el superadministrador puede activar o desactivar.
 * Lo que no está aquí (dashboard, notificaciones, perfil, usuarios, áreas, empresas y configuración) siempre está disponible.
 */
export const MODULE_CATALOG = [
  { key: 'intranet', label: 'Intranet', description: 'Sitio de cada empresa: inicio, estrategia, documentación y sistema de gestión.' },
  { key: 'requests', label: 'Solicitudes y formularios', description: 'Radicar, asignar y responder solicitudes entre áreas, con sus formularios.' },
  { key: 'reports', label: 'Reportes', description: 'Indicadores de cumplimiento, tiempos de respuesta y exportación.' },
  { key: 'tasks', label: 'Tareas', description: 'Los líderes crean tareas y las asignan a los colaboradores de su área.' },
  { key: 'attendance', label: 'Asistencia', description: 'Registro de entrada y salida verificado con un código enviado al correo.' },
  { key: 'schedules', label: 'Horarios', description: 'Los líderes asignan turnos: fijos, diarios, semanales o rotativos.' },
  { key: 'leaves', label: 'Permisos', description: 'Solicitud y aprobación de permisos, incapacidades y vacaciones.' },
  { key: 'performance', label: 'Desempeño', description: 'Cargos, roles y tareas por área, KPI por colaborador y tiempo dedicado a cada empresa.' },
] as const;

export type ModuleKey = (typeof MODULE_CATALOG)[number]['key'];
export const MODULE_KEYS = MODULE_CATALOG.map((m) => m.key) as string[];

export const REQUIRE_MODULE = 'requireModule';
/** Rechaza la petición si el módulo está desactivado para la empresa del usuario */
export const RequireModule = (key: ModuleKey) => SetMetadata(REQUIRE_MODULE, key);
