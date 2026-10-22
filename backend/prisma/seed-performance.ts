/**
 * Datos de demostración del módulo Desempeño (cargos, roles, tareas, KPI, mediciones y tiempo por empresa).
 *
 * A diferencia de `seed.ts` NO borra nada: solo agrega, sobre los usuarios y áreas que ya existen
 * (los de seed.ts). Es repetible: si un cargo ya existe en el área, se omite.
 * Los KPI cuelgan del rol (se miden a quien lo desempeña); las tareas del rol son donde se registra el tiempo.
 *
 *   npm run seed:performance
 */
import { Kpi, KpiDirection, KpiPeriod, PrismaClient, RoleTask } from '@prisma/client';

const prisma = new PrismaClient();

type KpiSpec = {
  name: string;
  unit: string;
  target: number;
  direction?: KpiDirection;
  period?: KpiPeriod;
  /** Mediciones de la más antigua a la más reciente (una por periodo, terminando en el actual) */
  values: number[];
};
type RoleSpec = { name: string; users: string[]; kpis: KpiSpec[]; tasks: string[] };
type PositionSpec = { name: string; roles: RoleSpec[] };
type AreaSpec = { area: string; positions: PositionSpec[] };

const PLAN: AreaSpec[] = [
  // Tecnología: la hoja de "Desarrollo" (Junior / Semi / Senior con sus roles)
  {
    area: 'Tecnología',
    positions: [
      {
        name: 'Junior',
        roles: [
          {
            name: 'Backend',
            users: ['camilo.ruiz@playtech.com.co'],
            kpis: [
              { name: 'Bugs resueltos en el plazo', unit: '%', target: 85, values: [72, 80, 91] },
              { name: 'Cobertura de pruebas', unit: '%', target: 70, values: [58, 63, 66] },
            ],
            tasks: ['Corregir bugs de los servicios asignados', 'Escribir pruebas unitarias', 'Documentar los endpoints'],
          },
          {
            name: 'Frontend',
            users: [],
            kpis: [{ name: 'Fidelidad al diseño', unit: '%', target: 90, values: [] }],
            tasks: ['Maquetar pantallas según el diseño'],
          },
        ],
      },
      {
        name: 'Semi',
        roles: [
          {
            name: 'Full Stack',
            users: ['valentina.diaz@playtech.com.co'],
            kpis: [
              { name: 'Historias entregadas en el sprint', unit: 'historias', target: 8, period: 'WEEKLY', values: [6, 8, 9, 7, 10, 8] },
              { name: 'Defectos escapados a producción', unit: 'defectos', target: 2, direction: 'LOWER_BETTER', values: [4, 3, 1] },
              { name: 'Revisiones en menos de 24 h', unit: '%', target: 90, values: [95, 92, 96] },
            ],
            tasks: ['Entregar funcionalidades de punta a punta', 'Revisar el código de compañeros'],
          },
          {
            name: 'Data Base',
            users: [],
            kpis: [{ name: 'Consultas de más de 1 s', unit: 'consultas', target: 5, direction: 'LOWER_BETTER', values: [] }],
            tasks: ['Optimizar consultas lentas'],
          },
        ],
      },
      {
        name: 'Senior',
        roles: [
          {
            name: 'Full Stack',
            users: ['juan.torres@playtech.com.co'],
            kpis: [
              { name: 'Diseños aprobados a la primera', unit: '%', target: 80, values: [74, 78, 83] },
              { name: 'Sesiones de mentoría', unit: 'sesiones', target: 4, period: 'WEEKLY', values: [1, 2, 1, 0, 1, 1] },
            ],
            tasks: ['Definir la arquitectura y revisar diseños técnicos', 'Acompañar y mentorear al equipo'],
          },
        ],
      },
    ],
  },

  // Talento Humano: la hoja (Administrador → Analista / Bienestar / Compras), atiende a 2 empresas
  {
    area: 'Talento Humano',
    positions: [
      {
        name: 'Administrador',
        roles: [
          {
            name: 'Analista',
            users: ['natalia.silva@playtech.com.co'],
            kpis: [
              { name: 'Nóminas sin reproceso', unit: '%', target: 98, values: [96, 99, 99.5] },
              { name: 'Tiempo de expedición de certificados', unit: 'horas', target: 24, direction: 'LOWER_BETTER', values: [40, 30, 22] },
            ],
            tasks: ['Liquidar y revisar la nómina', 'Expedir certificados laborales', 'Mantener actualizadas las hojas de vida'],
          },
          {
            name: 'Bienestar',
            users: ['paula.moreno@playtech.com.co'],
            kpis: [{ name: 'Asistencia a las actividades', unit: '%', target: 75, values: [60, 68, 71] }],
            tasks: ['Organizar las actividades de bienestar'],
          },
          { name: 'Compras', users: [], kpis: [], tasks: ['Cotizar y comprar dotación'] },
        ],
      },
    ],
  },

  // Calidad: área compartida con las 4 empresas, para ver el tiempo repartido en varias columnas
  {
    area: 'Calidad',
    positions: [
      {
        name: 'Analista',
        roles: [
          {
            name: 'Documental',
            users: ['andres.rojas@grupoplaytech.com'],
            kpis: [
              { name: 'Documentos vigentes', unit: '%', target: 95, values: [88, 93, 97] },
              { name: 'Solicitudes atendidas en 2 días', unit: '%', target: 90, values: [92, 85, 76] },
            ],
            tasks: ['Controlar y publicar documentos del sistema de gestión', 'Atender solicitudes de formatos'],
          },
          {
            name: 'Auditoría',
            users: ['maria.perez@grupoplaytech.com'],
            kpis: [
              { name: 'Auditorías del plan cumplidas', unit: '%', target: 100, values: [100, 90, 80] },
              { name: 'Hallazgos cerrados a tiempo', unit: '%', target: 85, values: [70, 82, 88] },
            ],
            tasks: ['Ejecutar auditorías internas', 'Seguimiento a hallazgos'],
          },
        ],
      },
    ],
  },

  // El superadministrador también tiene su propio desempeño (Mi desempeño), repartido entre las 4 empresas
  {
    area: 'Calidad',
    positions: [
      {
        name: 'Dirección',
        roles: [
          {
            name: 'Gerencia general',
            users: ['admin@grupoplaytech.com'],
            kpis: [
              { name: 'Reuniones de seguimiento realizadas', unit: 'reuniones', target: 4, period: 'WEEKLY', values: [3, 4, 4, 5, 4, 2] },
              { name: 'Planes de acción vigentes', unit: '%', target: 90, values: [82, 88, 93] },
              { name: 'Aprobaciones en menos de 3 días', unit: '%', target: 85, values: [90, 80, 78] },
              { name: 'Espacios 1 a 1 con líderes', unit: 'sesiones', target: 6, values: [5, 6, 8] },
            ],
            tasks: [
              'Hacer seguimiento al desempeño de las empresas del holding',
              'Aprobar presupuestos y decisiones de inversión',
              'Acompañar a los líderes de área',
              'Representar al grupo ante clientes y aliados',
            ],
          },
        ],
      },
    ],
  },

  // Infraestructura: 2 empresas
  {
    area: 'Infraestructura',
    positions: [
      {
        name: 'Senior',
        roles: [
          {
            name: 'Cloud',
            users: ['lina.jaramillo@enigma.co'],
            kpis: [
              { name: 'Disponibilidad', unit: '%', target: 99.9, values: [99.95, 99.7, 99.5] },
              { name: 'Ahorro mensual en la nube', unit: '%', target: 5, values: [3, 6, 7.5] },
            ],
            tasks: ['Garantizar la disponibilidad de los servidores', 'Optimizar el costo de la nube'],
          },
        ],
      },
    ],
  },
];

// ---------------------------------------------------------------- utilidades
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const bogotaToday = () => new Date(Date.now() - 5 * 3600000).toISOString().slice(0, 10);
const day = (s: string) => new Date(`${s}T00:00:00.000Z`);
const addDays = (s: string, n: number) => ymd(new Date(day(s).getTime() + n * 86400000));
const weekdayIdx = (s: string) => (day(s).getUTCDay() + 6) % 7; // 0 = lunes
const monthStart = (s: string) => `${s.slice(0, 7)}-01`;
const monthsBack = (s: string, n: number) => {
  const d = day(monthStart(s));
  return ymd(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - n, 1)));
};

/** Generador determinista: las mismas entradas dan siempre los mismos datos */
function rng(seed: string) {
  let h = 2166136261;
  for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const periodStartOf = (period: KpiPeriod, back: number, today: string) =>
  period === 'MONTHLY' ? monthsBack(today, back) : period === 'WEEKLY' ? addDays(addDays(today, -weekdayIdx(today)), -7 * back) : addDays(today, -back);

const MINUTES = [30, 45, 60, 60, 90, 90, 120, 150, 180];

async function main() {
  const today = bogotaToday();
  const admin = await prisma.user.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } });
  if (!admin) throw new Error('No hay un superadministrador: ejecuta primero `npm run seed`.');
  let created = 0;

  for (const spec of PLAN) {
    const area = await prisma.area.findFirst({
      where: { name: spec.area },
      include: { companies: { include: { company: { select: { id: true, name: true } } } }, members: { where: { role: 'LEADER' }, select: { userId: true } } },
    });
    if (!area) {
      console.log(`· Área “${spec.area}” no existe: se omite`);
      continue;
    }
    const companies = area.companies.map((c) => c.company);
    const leaderIds = area.members.map((m) => m.userId);

    for (const pos of spec.positions) {
      if (await prisma.jobPosition.findUnique({ where: { areaId_name: { areaId: area.id, name: pos.name } } })) {
        console.log(`· ${area.name} / ${pos.name}: ya existe, se omite`);
        continue;
      }
      const position = await prisma.jobPosition.create({ data: { areaId: area.id, name: pos.name } });

      for (const r of pos.roles) {
        const users = await prisma.user.findMany({ where: { email: { in: r.users } }, select: { id: true, email: true } });
        const missing = r.users.filter((e) => !users.some((u) => u.email === e));
        if (missing.length) console.log(`  ! Sin usuario: ${missing.join(', ')}`);
        // quien tiene un rol debe ser miembro del área (así aparece al asignar personas y en el equipo)
        for (const u of users) {
          await prisma.areaMember.upsert({
            where: { userId_areaId: { userId: u.id, areaId: area.id } },
            update: {},
            create: { userId: u.id, areaId: area.id, role: 'MEMBER' },
          });
        }
        const role = await prisma.jobRole.create({
          data: { positionId: position.id, name: r.name, assignments: { create: users.map((u) => ({ userId: u.id })) } },
        });

        // KPI del rol
        const kpis: { kpi: Kpi; spec: KpiSpec }[] = [];
        for (const k of r.kpis) {
          const kpi = await prisma.kpi.create({
            data: { roleId: role.id, name: k.name, unit: k.unit, target: k.target, direction: k.direction ?? 'HIGHER_BETTER', period: k.period ?? 'MONTHLY' },
          });
          kpis.push({ kpi, spec: k });
        }
        // Tareas del rol (donde se registra el tiempo)
        const tasks: RoleTask[] = [];
        for (const title of r.tasks) tasks.push(await prisma.roleTask.create({ data: { roleId: role.id, title } }));

        for (const u of users) {
          // Mediciones: la última corresponde al periodo actual; las anteriores, hacia atrás
          const recordedById = leaderIds.find((id) => id !== u.id) ?? admin.id;
          for (const { kpi, spec: k } of kpis)
            for (let i = 0; i < k.values.length; i++) {
              const back = k.values.length - 1 - i;
              await prisma.kpiMeasure.create({
                data: { kpiId: kpi.id, userId: u.id, recordedById, periodStart: day(periodStartOf(kpi.period, back, today)), value: k.values[i] },
              });
            }

          // Tiempo dedicado: días hábiles de las últimas 4 semanas, repartido entre las empresas del área
          for (const task of tasks) {
            const rand = rng(`${u.email}|${task.title}`);
            const weights = companies.map((_, i) => 1 + rand() * 2 + (i === 0 ? 1 : 0));
            const total = weights.reduce((a, b) => a + b, 0);
            const pick = () => {
              let x = rand() * total;
              for (let i = 0; i < companies.length; i++) if ((x -= weights[i]) <= 0) return companies[i];
              return companies[0];
            };
            for (let back = 0; back < 28; back++) {
              const date = addDays(today, -back);
              if (weekdayIdx(date) > 4 || rand() > 0.55) continue;
              const minutes = MINUTES[Math.floor(rand() * MINUTES.length)];
              await prisma.timeEntry.create({
                data: {
                  userId: u.id,
                  taskId: task.id,
                  companyId: pick().id,
                  date: day(date),
                  minutes,
                  // de vez en cuando lo registra el líder a nombre del colaborador
                  loggedById: rand() < 0.1 ? (leaderIds.find((id) => id !== u.id) ?? u.id) : u.id,
                },
              });
            }
          }
        }
      }
      created++;
      console.log(`✓ ${area.name} / ${pos.name}`);
    }
  }

  const [pos, roles, tasks, kpis, measures, time] = await Promise.all([
    prisma.jobPosition.count(),
    prisma.jobRole.count(),
    prisma.roleTask.count(),
    prisma.kpi.count(),
    prisma.kpiMeasure.count(),
    prisma.timeEntry.count(),
  ]);
  console.log(`\nCargos nuevos: ${created}. En total: ${pos} cargos, ${roles} roles, ${tasks} tareas, ${kpis} KPI, ${measures} mediciones, ${time} registros de tiempo.`);
  console.log('Contraseña de todos: Playtech2026*');
  console.log('  Líder de Tecnología:      juan.torres@playtech.com.co   (Equipo: Junior, Semi y Senior)');
  console.log('  Líder de Talento Humano:  paula.moreno@playtech.com.co  (2 empresas)');
  console.log('  Líder de Calidad:         laura.gomez@grupoplaytech.com (4 empresas)');
  console.log('  Colaboradora:             natalia.silva@playtech.com.co (Mi desempeño)');
  console.log('  Superadministrador:       admin@grupoplaytech.com       (Equipo → Todas las áreas, y Mi desempeño propio)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
