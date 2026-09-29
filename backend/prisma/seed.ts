/* eslint-disable no-console */
/**
 * Datos de demostración de Grupo Playtech.
 * Ejecutar: npm run seed   (borra y vuelve a crear todo)
 */
import { EventType, Prisma, PrismaClient, RequestStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ---------- utilidades ----------
// mulberry32: pseudoaleatorio reproducible con buena distribución
let seedN = 20260929;
const rnd = () => {
  seedN = (seedN + 0x6d2b79f5) | 0;
  let t = Math.imul(seedN ^ (seedN >>> 15), 1 | seedN);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = <T>(xs: T[]) => xs[Math.floor(rnd() * xs.length)];
const addHours = (d: Date, h: number) => new Date(d.getTime() + h * 3600000);
function addBusinessDays(start: Date, days: number) {
  const d = new Date(start);
  let n = 0;
  while (n < days) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) n++;
  }
  return d;
}
const f = (id: string, type: string, label: string, extra: Record<string, unknown> = {}) => ({ id, type, label, width: 'full', ...extra });

async function main() {
  console.log('Limpiando base de datos…');
  await prisma.mailLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.escalation.deleteMany();
  await prisma.attachment.deleteMany();
  await prisma.requestEvent.deleteMany();
  await prisma.request.deleteMany();
  await prisma.requestForm.deleteMany();
  await prisma.areaMember.deleteMany();
  await prisma.areaCompany.deleteMany();
  await prisma.area.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();

  const hash = await bcrypt.hash('Playtech2026*', 10);

  // ---------- empresas ----------
  console.log('Empresas…');
  const companies = {
    playtech: await prisma.company.create({
      data: {
        name: 'Playtech',
        slug: 'playtech',
        legalName: 'Playtech S.A.S.',
        nit: '900.123.456-1',
        slogan: 'Tecnología que conecta el entretenimiento',
        description: 'Casa matriz tecnológica del Grupo Playtech.',
        primaryColor: '#5b4ff5',
        secondaryColor: '#a78bfa',
        missionText:
          'Desarrollar plataformas tecnológicas robustas y escalables que impulsen los negocios del grupo y de nuestros aliados, con excelencia técnica y enfoque en el usuario.',
        visionText: 'En 2030 ser el referente latinoamericano en plataformas tecnológicas para entretenimiento y pagos digitales.',
        objectivesText: 'Garantizar la disponibilidad de las plataformas, acelerar la entrega de valor y fortalecer la cultura de innovación.',
        purposeText: 'Centralizar la información, facilitar la colaboración y optimizar los procesos internos de nuestro equipo.',
        managementSystem: 'NTC ISO 9001:2015 · ISO/IEC 27001',
        contactEmail: 'intranet@playtech.com.co',
        announcements: [
          'Bienvenidos a la nueva intranet del Grupo Playtech.',
          'Recuerda radicar tus solicitudes de acceso a sistemas desde la sección Solicitudes.',
          'El comité de seguridad se reúne el primer martes de cada mes.',
        ],
        values: ['Innovación', 'Confianza', 'Excelencia', 'Trabajo en equipo'],
      },
    }),
    tucompra: await prisma.company.create({
      data: {
        name: 'TuCompra',
        slug: 'tucompra',
        legalName: 'TUCOMPRA S.A.S.',
        nit: '900.654.321-7',
        slogan: 'Soluciones de pagos y recaudo digital',
        description: 'Plataforma de pagos, recaudo y servicios digitales.',
        primaryColor: '#1d4ed8',
        secondaryColor: '#38bdf8',
        missionText:
          'TUCOMPRA S.A.S. proporciona soluciones tecnológicas integrales para pagos, recaudo y servicios digitales, facilitando la transformación digital de empresas y comercios mediante plataformas seguras, confiables, innovadoras y de alta disponibilidad.',
        visionText:
          'Para el año 2030, TUCOMPRA S.A.S. será reconocida como una de las principales empresas de servicios tecnológicos y soluciones de pagos digitales en Colombia, destacándose por la innovación, la seguridad de la información y la confiabilidad de sus servicios.',
        objectivesText:
          'Fortalecer continuamente las soluciones tecnológicas, la infraestructura y los servicios digitales de TUCOMPRA, garantizando disponibilidad, seguridad, escalabilidad, innovación y una experiencia satisfactoria para clientes y usuarios.',
        purposeText:
          'Centralizar la información, facilitar la colaboración y optimizar los procesos internos para impulsar la eficiencia, la innovación y el crecimiento de nuestro equipo.',
        managementSystem: 'NTC ISO 9001:2015',
        contactEmail: 'calidad@tucompra.com.co',
        announcements: [
          'Solicitudes de creación, actualización o eliminación de documentos: 3 a 5 días hábiles.',
          'Creación o actualización de políticas: 5 a 7 días hábiles.',
          'Ya está disponible la Declaración de la Política TUCOMPRA 2026 en Documentación.',
        ],
        values: ['Calidad', 'Confianza', 'Comunicación', 'Compromiso'],
      },
    }),
    enjambre: await prisma.company.create({
      data: {
        name: 'Enjambre',
        slug: 'enjambre',
        legalName: 'Enjambre Creativo S.A.S.',
        nit: '901.222.333-4',
        slogan: 'Creatividad que trabaja en equipo',
        description: 'Agencia de marketing, contenido y experiencia de marca del grupo.',
        primaryColor: '#d97706',
        secondaryColor: '#fcd34d',
        missionText: 'Crear experiencias de marca memorables que conecten a las empresas del grupo con sus audiencias.',
        visionText: 'Ser la agencia creativa más influyente del ecosistema de entretenimiento digital en la región.',
        objectivesText: 'Aumentar el alcance de las marcas del grupo y medir el impacto de cada campaña.',
        purposeText: 'Un espacio para compartir ideas, recursos y avanzar juntos como colmena.',
        announcements: ['Nuevo manual de marca disponible en Documentación.', 'Cierre de campañas del trimestre: viernes 30.'],
        values: ['Creatividad', 'Colaboración', 'Agilidad'],
      },
    }),
    enigma: await prisma.company.create({
      data: {
        name: 'Enigma',
        slug: 'enigma',
        legalName: 'Enigma Security S.A.S.',
        nit: '901.444.555-6',
        slogan: 'Seguridad que no se ve, pero se siente',
        description: 'Ciberseguridad e infraestructura del Grupo Playtech.',
        primaryColor: '#0f766e',
        secondaryColor: '#5eead4',
        missionText: 'Proteger la información y la infraestructura del grupo con controles efectivos y una cultura de seguridad.',
        visionText: 'Ser el aliado de confianza en ciberseguridad para el ecosistema digital colombiano.',
        objectivesText: 'Reducir incidentes de seguridad, garantizar la continuidad del negocio y cumplir la normatividad vigente.',
        purposeText: 'Reunir procedimientos, alertas y solicitudes de seguridad en un solo lugar.',
        managementSystem: 'ISO/IEC 27001:2022',
        announcements: ['Actualiza tu contraseña cada 90 días.', 'Reporta cualquier correo sospechoso al área de Seguridad.'],
        values: ['Integridad', 'Discreción', 'Resiliencia'],
      },
    }),
  };
  const allCompanies = Object.values(companies);

  // ---------- áreas ----------
  console.log('Áreas…');
  const area = async (name: string, icon: string, companyIds: string[], description: string) =>
    prisma.area.create({
      data: { name, icon, description, isShared: companyIds.length > 1, companies: { create: companyIds.map((companyId) => ({ companyId })) } },
    });
  const A = {
    calidad: await area('Calidad', 'shield-check', allCompanies.map((c) => c.id), 'Sistema de Gestión de Calidad del holding: documentos, políticas y auditorías.'),
    juridica: await area('Jurídica', 'scale', allCompanies.map((c) => c.id), 'Contratos, conceptos jurídicos y cumplimiento normativo para todas las empresas.'),
    tecnologia: await area('Tecnología', 'cpu', [companies.playtech.id], 'Soporte técnico, accesos y desarrollo.'),
    talento: await area('Talento Humano', 'users', [companies.playtech.id, companies.enjambre.id], 'Certificados, vacaciones y bienestar.'),
    operaciones: await area('Operaciones', 'cog', [companies.tucompra.id], 'Operación de pagos y recaudo.'),
    soporte: await area('Soporte', 'headset', [companies.tucompra.id], 'Mesa de ayuda a comercios y usuarios.'),
    marketing: await area('Marketing', 'megaphone', [companies.enjambre.id], 'Campañas, piezas y contenido.'),
    seguridad: await area('Seguridad de la Información', 'lock', [companies.enigma.id], 'Accesos, incidentes y controles de seguridad.'),
    infra: await area('Infraestructura', 'server', [companies.enigma.id, companies.tucompra.id], 'Servidores, redes y nube.'),
  };

  // ---------- usuarios ----------
  console.log('Usuarios…');
  const user = (email: string, name: string, jobTitle: string, companyId: string | null, role: 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'USER' = 'USER') =>
    prisma.user.create({ data: { email, name, jobTitle, companyId, role, passwordHash: hash } });

  const U = {
    admin: await user('admin@grupoplaytech.com', 'Administrador Holding', 'Administrador del Holding', companies.playtech.id, 'SUPER_ADMIN'),
    // Calidad (compartida)
    calidadLider: await user('laura.gomez@grupoplaytech.com', 'Laura Gómez', 'Líder de Calidad', companies.playtech.id),
    calidad1: await user('andres.rojas@grupoplaytech.com', 'Andrés Rojas', 'Analista de Calidad', companies.playtech.id),
    calidad2: await user('maria.perez@grupoplaytech.com', 'María Pérez', 'Auditora Interna', companies.tucompra.id),
    // Jurídica (compartida)
    juridicaLider: await user('carlos.mejia@grupoplaytech.com', 'Carlos Mejía', 'Director Jurídico', companies.playtech.id),
    juridica1: await user('sofia.vargas@grupoplaytech.com', 'Sofía Vargas', 'Abogada', companies.playtech.id),
    // Playtech
    ptAdmin: await user('admin@playtech.com.co', 'Diana Castro', 'Administradora de intranet', companies.playtech.id, 'COMPANY_ADMIN'),
    tecLider: await user('juan.torres@playtech.com.co', 'Juan Torres', 'Líder de Tecnología', companies.playtech.id),
    tec1: await user('camilo.ruiz@playtech.com.co', 'Camilo Ruiz', 'Ingeniero de soporte', companies.playtech.id),
    tec2: await user('valentina.diaz@playtech.com.co', 'Valentina Díaz', 'Desarrolladora', companies.playtech.id),
    thLider: await user('paula.moreno@playtech.com.co', 'Paula Moreno', 'Líder de Talento Humano', companies.playtech.id),
    th1: await user('natalia.silva@playtech.com.co', 'Natalia Silva', 'Analista de nómina', companies.playtech.id),
    ptEmp: await user('james.osorio@playtech.com.co', 'James Osorio', 'Product Designer', companies.playtech.id),
    // TuCompra
    tcAdmin: await user('admin@tucompra.com.co', 'Ricardo León', 'Administrador de intranet', companies.tucompra.id, 'COMPANY_ADMIN'),
    opLider: await user('luisa.fernandez@tucompra.com.co', 'Luisa Fernández', 'Líder de Operaciones', companies.tucompra.id),
    op1: await user('mateo.herrera@tucompra.com.co', 'Mateo Herrera', 'Analista de operaciones', companies.tucompra.id),
    sopLider: await user('daniela.cano@tucompra.com.co', 'Daniela Cano', 'Líder de Soporte', companies.tucompra.id),
    sop1: await user('sebastian.lopez@tucompra.com.co', 'Sebastián López', 'Agente de soporte', companies.tucompra.id),
    tcEmp: await user('rachel.lee@tucompra.com.co', 'Rachel Lee', 'Ejecutiva comercial', companies.tucompra.id),
    // Enjambre
    ejAdmin: await user('admin@enjambre.co', 'Tomás Arango', 'Administrador de intranet', companies.enjambre.id, 'COMPANY_ADMIN'),
    mkLider: await user('isabel.restrepo@enjambre.co', 'Isabel Restrepo', 'Líder de Marketing', companies.enjambre.id),
    mk1: await user('felipe.garcia@enjambre.co', 'Felipe García', 'Diseñador gráfico', companies.enjambre.id),
    ejEmp: await user('manuela.quintero@enjambre.co', 'Manuela Quintero', 'Community Manager', companies.enjambre.id),
    // Enigma
    egAdmin: await user('admin@enigma.co', 'Hernán Pineda', 'Administrador de intranet', companies.enigma.id, 'COMPANY_ADMIN'),
    segLider: await user('alejandro.nieto@enigma.co', 'Alejandro Nieto', 'CISO', companies.enigma.id),
    seg1: await user('karen.ospina@enigma.co', 'Karen Ospina', 'Analista SOC', companies.enigma.id),
    infLider: await user('oscar.benitez@enigma.co', 'Óscar Benítez', 'Líder de Infraestructura', companies.enigma.id),
    inf1: await user('lina.jaramillo@enigma.co', 'Lina Jaramillo', 'Ingeniera cloud', companies.enigma.id),
    egEmp: await user('david.rincon@enigma.co', 'David Rincón', 'Pentester', companies.enigma.id),
  };

  const members: [keyof typeof A, keyof typeof U, 'LEADER' | 'MEMBER'][] = [
    ['calidad', 'calidadLider', 'LEADER'],
    ['calidad', 'calidad1', 'MEMBER'],
    ['calidad', 'calidad2', 'MEMBER'],
    ['juridica', 'juridicaLider', 'LEADER'],
    ['juridica', 'juridica1', 'MEMBER'],
    ['tecnologia', 'tecLider', 'LEADER'],
    ['tecnologia', 'tec1', 'MEMBER'],
    ['tecnologia', 'tec2', 'MEMBER'],
    ['talento', 'thLider', 'LEADER'],
    ['talento', 'th1', 'MEMBER'],
    ['operaciones', 'opLider', 'LEADER'],
    ['operaciones', 'op1', 'MEMBER'],
    ['soporte', 'sopLider', 'LEADER'],
    ['soporte', 'sop1', 'MEMBER'],
    ['marketing', 'mkLider', 'LEADER'],
    ['marketing', 'mk1', 'MEMBER'],
    ['seguridad', 'segLider', 'LEADER'],
    ['seguridad', 'seg1', 'MEMBER'],
    ['infra', 'infLider', 'LEADER'],
    ['infra', 'inf1', 'MEMBER'],
  ];
  for (const [a, u, role] of members) await prisma.areaMember.create({ data: { areaId: A[a].id, userId: U[u].id, role } });

  // ---------- formularios ----------
  console.log('Formularios…');
  const PROCESOS = ['Gestión Estratégica', 'Mejoramiento Continuo', 'Gestión de Ingeniería', 'Gestión Comercial', 'Gestión Operativa', 'Gestión de Seguridad de la Información', 'Gestión Administrativa'];
  const form = (areaId: string, name: string, icon: string, slaDays: number, fields: object[], description: string, defaultPriority: 'LOW' | 'MEDIUM' | 'HIGH' = 'MEDIUM') =>
    prisma.requestForm.create({ data: { areaId, name, icon, slaDays, fields: fields as any, description, defaultPriority } });

  const F = [
    await form(A.calidad.id, 'Creación, actualización o eliminación de documento', 'file-text', 5, [
      f('tipo', 'radio', 'Tipo de solicitud', { required: true, options: ['Creación', 'Actualización', 'Eliminación'] }),
      f('proceso', 'select', 'Proceso', { required: true, options: PROCESOS, width: 'half' }),
      f('categoria', 'select', 'Tipo de documento', { required: true, options: ['Formato', 'Procedimiento', 'Instructivo', 'Manual', 'Registro'], width: 'half' }),
      f('nombre', 'text', 'Nombre del documento', { required: true, placeholder: 'Ej.: Procedimiento de control de cambios' }),
      f('descripcion', 'textarea', 'Descripción del cambio', { required: true, help: 'Explica qué se crea o cambia y por qué.' }),
      f('archivo', 'file', 'Documento propuesto', { help: 'Adjunta el borrador en Word o PDF.' }),
      f('socializar', 'radio', '¿Requiere socialización?', { options: ['Sí', 'No'] }),
    ], 'Gestión documental del Sistema de Gestión de Calidad.'),
    await form(A.calidad.id, 'Creación o actualización de política', 'shield', 7, [
      f('politica', 'text', 'Nombre de la política', { required: true }),
      f('alcance', 'checkbox', 'Empresas a las que aplica', { options: ['Playtech', 'TuCompra', 'Enjambre', 'Enigma'] }),
      f('justificacion', 'textarea', 'Justificación', { required: true }),
      f('borrador', 'file', 'Borrador de la política'),
    ], 'Políticas corporativas del holding.', 'HIGH'),
    await form(A.calidad.id, 'Solicitud de auditoría interna', 'clipboard-check', 10, [
      f('proceso', 'select', 'Proceso a auditar', { required: true, options: PROCESOS }),
      f('fecha', 'date', 'Fecha sugerida', { width: 'half' }),
      f('motivo', 'textarea', 'Motivo', { required: true }),
    ], 'Programación de auditorías fuera del plan anual.'),
    await form(A.juridica.id, 'Revisión de contrato', 'file-signature', 5, [
      f('sec1', 'section', 'Datos de la contraparte'),
      f('contraparte', 'text', 'Nombre o razón social', { required: true, width: 'half' }),
      f('nit', 'text', 'NIT / Documento', { width: 'half' }),
      f('tipo', 'select', 'Tipo de contrato', { required: true, options: ['Prestación de servicios', 'Compraventa', 'Confidencialidad (NDA)', 'Arrendamiento', 'Alianza comercial'] }),
      f('valor', 'number', 'Valor estimado (COP)', { width: 'half' }),
      f('fecha', 'date', 'Fecha requerida de firma', { width: 'half' }),
      f('contrato', 'file', 'Contrato o minuta', { required: true }),
      f('obs', 'textarea', 'Observaciones'),
    ], 'Revisión y visto bueno jurídico de contratos.', 'HIGH'),
    await form(A.juridica.id, 'Concepto jurídico', 'scale', 8, [
      f('tema', 'text', 'Tema', { required: true }),
      f('pregunta', 'textarea', 'Pregunta o situación a analizar', { required: true }),
      f('soportes', 'file', 'Soportes'),
    ], 'Consultas legales y de cumplimiento.'),
    await form(A.tecnologia.id, 'Soporte técnico', 'wrench', 2, [
      f('equipo', 'select', 'Tipo de problema', { required: true, options: ['Computador', 'Correo', 'VPN', 'Impresora', 'Software', 'Otro'] }),
      f('detalle', 'textarea', 'Describe el problema', { required: true }),
      f('captura', 'file', 'Captura de pantalla'),
    ], 'Incidentes con equipos y herramientas.', 'HIGH'),
    await form(A.tecnologia.id, 'Acceso a sistemas', 'key', 1, [
      f('sistema', 'checkbox', 'Sistemas', { required: true, options: ['Jira', 'GitLab', 'AWS', 'Google Workspace', 'ERP'] }),
      f('perfil', 'text', 'Perfil o rol requerido'),
      f('justif', 'textarea', 'Justificación', { required: true }),
    ], 'Creación o modificación de accesos.'),
    await form(A.talento.id, 'Certificado laboral', 'award', 3, [
      f('dirigido', 'text', 'Dirigido a', { placeholder: 'A quien interese' }),
      f('salario', 'radio', '¿Incluir salario?', { options: ['Sí', 'No'], required: true }),
    ], 'Certificados laborales y de ingresos.', 'LOW'),
    await form(A.talento.id, 'Solicitud de vacaciones', 'calendar', 5, [
      f('desde', 'date', 'Desde', { required: true, width: 'half' }),
      f('hasta', 'date', 'Hasta', { required: true, width: 'half' }),
      f('obs', 'textarea', 'Observaciones'),
    ], 'Programación de vacaciones.'),
    await form(A.operaciones.id, 'Conciliación de recaudo', 'wallet', 3, [
      f('comercio', 'text', 'Comercio', { required: true }),
      f('fecha', 'date', 'Fecha del recaudo', { required: true, width: 'half' }),
      f('valor', 'number', 'Valor en diferencia', { width: 'half' }),
      f('soporte', 'file', 'Soporte'),
    ], 'Diferencias en conciliaciones.'),
    await form(A.soporte.id, 'Caso de comercio', 'headset', 2, [
      f('comercio', 'text', 'Comercio', { required: true }),
      f('canal', 'select', 'Canal', { options: ['Correo', 'Teléfono', 'WhatsApp'], width: 'half' }),
      f('detalle', 'textarea', 'Detalle', { required: true }),
    ], 'Casos escalados por comercios.'),
    await form(A.marketing.id, 'Pieza gráfica', 'palette', 4, [
      f('formato', 'checkbox', 'Formatos', { required: true, options: ['Post', 'Historia', 'Banner web', 'Correo', 'Impreso'] }),
      f('mensaje', 'textarea', 'Mensaje principal', { required: true }),
      f('referencias', 'file', 'Referencias'),
      f('fecha', 'date', 'Fecha de publicación'),
    ], 'Diseño de piezas para las marcas del grupo.'),
    await form(A.seguridad.id, 'Reporte de incidente de seguridad', 'alert', 1, [
      f('tipo', 'select', 'Tipo de incidente', { required: true, options: ['Phishing', 'Malware', 'Acceso no autorizado', 'Pérdida de equipo', 'Otro'] }),
      f('detalle', 'textarea', '¿Qué ocurrió?', { required: true }),
      f('evidencia', 'file', 'Evidencia'),
    ], 'Reporte inmediato de incidentes.', 'HIGH'),
    await form(A.infra.id, 'Solicitud de infraestructura', 'server', 5, [
      f('recurso', 'select', 'Recurso', { required: true, options: ['Servidor', 'Base de datos', 'Balanceador', 'Almacenamiento', 'DNS'] }),
      f('ambiente', 'radio', 'Ambiente', { options: ['Desarrollo', 'Pruebas', 'Producción'], required: true }),
      f('detalle', 'textarea', 'Especificaciones', { required: true }),
    ], 'Aprovisionamiento de recursos.'),
  ];

  // ---------- documentos (intranet TuCompra) ----------
  const drive = 'https://drive.google.com/';
  await prisma.document.createMany({
    data: [
      { companyId: companies.tucompra.id, category: 'politicas', process: 'Gestión Estratégica', title: 'Declaración de la Política TUCOMPRA 2026', url: drive, featured: true },
      { companyId: companies.tucompra.id, category: 'registros', process: 'Gestión Estratégica', title: 'Acta de socialización y aprobación de la Política del SGI', url: drive, featured: true },
      { companyId: companies.tucompra.id, category: 'registros', process: 'Gestión Estratégica', title: 'Plan Anual de Auditoría Interna 2026', url: drive, featured: true },
      { companyId: companies.tucompra.id, category: 'manuales', process: 'Gestión Estratégica', title: 'TC-CA-MA_3.0 Manual Corporativo - Direccionamiento', url: drive, featured: true },
      { companyId: companies.playtech.id, category: 'manuales', process: 'Gestión de Ingeniería', title: 'Manual de desarrollo seguro', url: drive, featured: true },
      { companyId: companies.playtech.id, category: 'politicas', process: 'Gestión Administrativa', title: 'Política de trabajo remoto', url: drive, featured: true },
      { companyId: companies.enjambre.id, category: 'manuales', process: 'Gestión Comercial', title: 'Manual de marca 2026', url: drive, featured: true },
      { companyId: companies.enigma.id, category: 'politicas', process: 'Gestión de Seguridad de la Información', title: 'Política de seguridad de la información', url: drive, featured: true },
    ],
  });

  // ---------- histórico de solicitudes ----------
  console.log('Solicitudes de ejemplo…');
  const areaMembers = await prisma.areaMember.findMany({ include: { user: true } });
  const areaCompanies = await prisma.areaCompany.findMany();
  const employees = await prisma.user.findMany({ where: { role: { not: 'SUPER_ADMIN' } } });
  const now = new Date();
  const SUBJECTS: Record<string, string[]> = {
    [A.calidad.id]: ['Actualizar procedimiento de control de cambios', 'Nuevo formato de acta de comité', 'Eliminar instructivo obsoleto', 'Actualizar política de calidad', 'Auditoría al proceso comercial'],
    [A.juridica.id]: ['Revisión NDA con proveedor cloud', 'Contrato de alianza con banco', 'Concepto sobre tratamiento de datos', 'Contrato de arrendamiento oficina'],
    [A.tecnologia.id]: ['El portátil no enciende', 'Acceso a GitLab para nuevo desarrollador', 'Falla en la VPN', 'Licencia de Figma'],
    [A.talento.id]: ['Certificado laboral para banco', 'Vacaciones de fin de año', 'Certificado de ingresos'],
    [A.operaciones.id]: ['Diferencia en recaudo del comercio Éxito', 'Conciliación pendiente de septiembre'],
    [A.soporte.id]: ['Comercio sin acceso al portal', 'Error en pagos PSE'],
    [A.marketing.id]: ['Piezas para lanzamiento de producto', 'Banner para campaña de navidad'],
    [A.seguridad.id]: ['Correo sospechoso de phishing', 'Pérdida de equipo corporativo'],
    [A.infra.id]: ['Nueva base de datos para reportes', 'Servidor de pruebas para QA'],
  };

  const queue: { created: Date; run: () => Promise<void> }[] = [];
  for (let i = 0; i < 90; i++) {
    const fm = pick(F);
    const areaId = fm.areaId;
    const served = areaCompanies.filter((ac) => ac.areaId === areaId).map((ac) => ac.companyId);
    const companyId = pick(served);
    const team = areaMembers.filter((m) => m.areaId === areaId);
    const requester = pick(employees.filter((e) => e.companyId === companyId && !team.some((t) => t.userId === e.id)).concat(employees.filter((e) => e.companyId === companyId)).slice(0, 12));
    const daysAgo = Math.floor(Math.pow(rnd(), 1.4) * 160);
    let created = new Date(now.getTime() - daysAgo * 86400000);
    created.setHours(8 + Math.floor(rnd() * 9), Math.floor(rnd() * 60), 0, 0);
    if (created > now) created = addHours(now, -3);
    const dueAt = addBusinessDays(created, fm.slaDays);
    const leader = team.find((t) => t.role === 'LEADER')!;
    const worker = pick(team);
    const peer = team.find((t) => t.userId !== worker.userId) || leader;

    // Estado final según antigüedad
    const r = rnd();
    let status: RequestStatus;
    if (daysAgo > 14) status = r < 0.83 ? 'RESOLVED' : r < 0.9 ? 'CANCELLED' : r < 0.96 ? 'IN_PROGRESS' : 'ESCALATION_REQUESTED';
    else if (daysAgo > 3) status = r < 0.45 ? 'RESOLVED' : r < 0.7 ? 'IN_PROGRESS' : r < 0.82 ? 'ASSIGNED' : r < 0.9 ? 'ESCALATION_REQUESTED' : 'PENDING_ASSIGNMENT';
    else status = r < 0.15 ? 'RESOLVED' : r < 0.4 ? 'IN_PROGRESS' : r < 0.6 ? 'ASSIGNED' : 'PENDING_ASSIGNMENT';

    const events: Prisma.RequestEventCreateManyInput[] = [];
    const ev = (type: EventType, at: Date, actorId: string | null, extra: Partial<Prisma.RequestEventCreateManyInput> = {}) =>
      events.push({ requestId: '', type, createdAt: at, actorId, ...extra });

    ev('CREATED', created, requester.id, { toAreaId: areaId, message: `Solicitud radicada. Plazo: ${fm.slaDays} día(s) hábil(es).` });
    let assigneeId: string | null = null;
    let assignedAt: Date | null = null;
    let acceptedAt: Date | null = null;
    let resolvedAt: Date | null = null;
    let responseText: string | null = null;
    const assignDelay = 1 + rnd() * 10;

    if (status !== 'PENDING_ASSIGNMENT' && !(status === 'CANCELLED' && rnd() < 0.5)) {
      assigneeId = worker.userId;
      assignedAt = addHours(created, assignDelay);
      ev('ASSIGNED', assignedAt, leader.userId, { toUserId: worker.userId, meta: { toUserName: worker.user.name } });
      if (status !== 'ASSIGNED') {
        acceptedAt = addHours(assignedAt, 0.5 + rnd() * 6);
        ev('ACCEPTED', acceptedAt, worker.userId);
      }
    }
    if (status === 'ESCALATION_REQUESTED') {
      ev('ESCALATION_REQUESTED', addHours(acceptedAt || assignedAt || created, 5), worker.userId, {
        message: 'No tengo los permisos necesarios para gestionar esta solicitud; requiere revisión de otra persona del equipo.',
        toUserId: peer.userId,
        meta: { targetType: 'USER', targetName: peer.user.name },
      });
    }
    if (status === 'RESOLVED') {
      const slaHours = (dueAt.getTime() - created.getTime()) / 3600000;
      const onTime = rnd() < 0.8;
      resolvedAt = addHours(created, onTime ? slaHours * (0.2 + rnd() * 0.75) : slaHours * (1.05 + rnd() * 0.8));
      if (resolvedAt > now) resolvedAt = addHours(now, -1);
      if (acceptedAt && resolvedAt < acceptedAt) resolvedAt = addHours(acceptedAt, 1);
      // Algunas resueltas pasaron por un traslado
      responseText = 'Solicitud atendida. Adjuntamos la información solicitada y quedamos atentos a cualquier inquietud.';
      ev('RESPONDED', resolvedAt, assigneeId, { message: responseText, meta: { late: resolvedAt > dueAt } });
    }
    if (status === 'CANCELLED') ev('CANCELLED', addHours(created, 20), requester.id, { message: 'Ya no se requiere.' });
    const isOpen = !['RESOLVED', 'CANCELLED'].includes(status);
    if (isOpen && dueAt < now) ev('OVERDUE_ALERT', dueAt, null, { message: 'La solicitud superó el plazo de respuesta.' });

    const data: Record<string, unknown> = {};
    for (const fld of fm.fields as any[]) {
      if (fld.type === 'section' || fld.type === 'file') continue;
      if (fld.options) data[fld.id] = fld.type === 'checkbox' ? [pick(fld.options)] : pick(fld.options);
      else if (fld.type === 'number') data[fld.id] = Math.round(rnd() * 50) * 100000;
      else if (fld.type === 'date') data[fld.id] = addBusinessDays(created, 10).toISOString().slice(0, 10);
      else if (fld.required) data[fld.id] = fld.type === 'textarea' ? 'Se requiere apoyo con esta solicitud según lo descrito en el asunto.' : 'Información de ejemplo';
    }

    queue.push({ created, run: async () => {
    const req = await prisma.request.create({
      data: {
        subject: pick(SUBJECTS[areaId] || ['Solicitud general']),
        formId: fm.id,
        formSnapshot: fm.fields as any,
        data: data as any,
        areaId,
        originAreaId: areaId,
        companyId,
        requesterId: requester.id,
        assigneeId,
        status,
        priority: rnd() < 0.15 ? 'URGENT' : rnd() < 0.35 ? 'HIGH' : rnd() < 0.8 ? 'MEDIUM' : 'LOW',
        slaDays: fm.slaDays,
        dueAt,
        assignedAt,
        acceptedAt,
        resolvedAt,
        responseText,
        overdueNotifiedAt: isOpen && dueAt < now ? now : null,
        dueSoonNotifiedAt: isOpen && dueAt < addHours(now, 24) ? now : null,
        createdAt: created,
      },
    });
    await prisma.requestEvent.createMany({ data: events.map((e) => ({ ...e, requestId: req.id })) });
    if (status === 'ESCALATION_REQUESTED')
      await prisma.escalation.create({
        data: {
          requestId: req.id,
          requestedById: worker.userId,
          targetType: 'USER',
          targetUserId: peer.userId,
          reason: 'No tengo los permisos necesarios para gestionar esta solicitud; requiere revisión de otra persona del equipo.',
        },
      });
    } });
  }
  queue.sort((a, b) => a.created.getTime() - b.created.getTime());
  for (const q of queue) await q.run();

  console.log('\n✅ Datos de demostración creados. Contraseña de todos los usuarios: Playtech2026*');
  console.log('   Superadministrador:      admin@grupoplaytech.com');
  console.log('   Líder de Calidad (compartida): laura.gomez@grupoplaytech.com');
  console.log('   Líder de Tecnología:     juan.torres@playtech.com.co');
  console.log('   Colaborador de Calidad:  andres.rojas@grupoplaytech.com');
  console.log('   Empleado TuCompra:       rachel.lee@tucompra.com.co');
  console.log('   Admin intranet TuCompra: admin@tucompra.com.co');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
