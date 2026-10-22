export type GlobalRole = 'SUPER_ADMIN' | 'COMPANY_ADMIN' | 'USER';
export type AreaRole = 'LEADER' | 'MEMBER';
export type RequestStatus = 'PENDING_ASSIGNMENT' | 'ASSIGNED' | 'IN_PROGRESS' | 'ESCALATION_REQUESTED' | 'RESOLVED' | 'CANCELLED';
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';

export interface CompanyBrief {
  id: string;
  name: string;
  slug: string;
  primaryColor: string;
  secondaryColor?: string;
  logoUrl?: string | null;
}

export interface Company extends CompanyBrief {
  legalName?: string | null;
  nit?: string | null;
  slogan?: string | null;
  description?: string | null;
  secondaryColor: string;
  heroImageUrl?: string | null;
  missionText?: string | null;
  missionImageUrl?: string | null;
  visionText?: string | null;
  visionImageUrl?: string | null;
  objectivesText?: string | null;
  purposeText?: string | null;
  organigramUrl?: string | null;
  managementSystem?: string | null;
  contactEmail?: string | null;
  website?: string | null;
  announcements: string[];
  values: string[];
  active: boolean;
  _count?: { users: number; areas: number; requests: number };
}

export interface DocumentItem {
  id: string;
  companyId: string;
  category: string;
  process?: string | null;
  title: string;
  url: string;
  featured: boolean;
}

export interface IntranetArea {
  id: string;
  name: string;
  description?: string | null;
  icon: string;
  isShared: boolean;
  forms: { id: string; name: string; description?: string | null; icon: string; slaDays: number }[];
  leaders: { id: string; name: string; email: string }[];
}

export interface IntranetCompany extends Company {
  areas: IntranetArea[];
  documents: DocumentItem[];
}

export interface Me {
  id: string;
  email: string;
  name: string;
  jobTitle?: string | null;
  phone?: string | null;
  avatarUrl?: string | null;
  role: GlobalRole;
  companyId: string | null;
  company: CompanyBrief | null;
  memberships: { id: string; role: AreaRole; area: { id: string; name: string; icon: string; isShared: boolean } }[];
  /** Recorridos guiados ya vistos (claves de lib/tours.ts) */
  toursSeen?: string[];
  /** Módulos activos para su empresa y si al entrar ve la intranet (los define el superadministrador) */
  settings?: AppSettings;
}

export interface UserBrief {
  id: string;
  name: string;
  email: string;
  jobTitle?: string | null;
  avatarUrl?: string | null;
  companyId?: string | null;
}

export type FieldType = 'text' | 'textarea' | 'number' | 'email' | 'date' | 'select' | 'radio' | 'checkbox' | 'file' | 'section';

export interface FormField {
  id: string;
  type: FieldType;
  label: string;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: string[];
  width?: 'full' | 'half';
}

export interface RequestForm {
  id: string;
  areaId: string;
  name: string;
  description?: string | null;
  icon: string;
  slaDays: number;
  defaultPriority: Priority;
  fields: FormField[];
  active: boolean;
  version: number;
  updatedAt: string;
  area?: { id: string; name: string; icon: string; isShared: boolean; companies?: { company: { id: string; name: string } }[] };
  _count?: { requests: number };
}

export interface FileValue {
  fileName: string;
  url: string;
  mimeType?: string;
  size?: number;
}

export interface RequestItem {
  id: string;
  seq: number;
  code: string;
  subject: string;
  status: RequestStatus;
  priority: Priority;
  slaDays: number;
  dueAt: string;
  createdAt: string;
  assignedAt?: string | null;
  acceptedAt?: string | null;
  resolvedAt?: string | null;
  isOverdue: boolean;
  resolvedLate: boolean;
  slaProgress: number;
  remainingMs: number;
  area: { id: string; name: string; icon: string; isShared: boolean };
  company: CompanyBrief;
  requester: UserBrief;
  assignee: UserBrief | null;
  form: { id: string; name: string; icon: string };
}

export interface RequestEvent {
  id: string;
  type: string;
  createdAt: string;
  message?: string | null;
  meta?: Record<string, any> | null;
  actor?: UserBrief | null;
  toUserId?: string | null;
}

export interface RequestDetail extends RequestItem {
  data: Record<string, any>;
  formSnapshot: FormField[];
  responseText?: string | null;
  events: RequestEvent[];
  attachments: (FileValue & { id: string; kind: string; eventId?: string | null; createdAt: string; uploadedBy?: { name: string } | null })[];
  escalations: {
    id: string;
    targetType: 'USER' | 'AREA';
    reason: string;
    status: 'PENDING' | 'RESOLVED';
    resolution?: string | null;
    createdAt: string;
    requestedBy: { id: string; name: string };
    targetUser?: { id: string; name: string } | null;
    targetArea?: { id: string; name: string } | null;
  }[];
  mailLogs: { id: string; to: string; subject: string; event: string; status: string; createdAt: string }[];
  permissions: {
    isLeader: boolean;
    isAssignee: boolean;
    isRequester: boolean;
    canAssign: boolean;
    canAccept: boolean;
    canEscalate: boolean;
    canRespond: boolean;
    canResolveEscalation: boolean;
    canReassign: boolean;
    canTransfer: boolean;
    canComment: boolean;
    canCancel: boolean;
  };
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

export interface Area {
  id: string;
  name: string;
  description?: string | null;
  icon: string;
  isShared: boolean;
  active: boolean;
  companies: { company: { id: string; name: string; primaryColor: string; slug?: string } }[];
  members: { id: string; role: AreaRole; user: UserBrief }[];
  _count?: { forms: number; requests: number };
}

export interface DirectoryUser extends UserBrief {
  company?: { id: string; name: string; primaryColor: string } | null;
  memberships: { role: AreaRole; area: { id: string; name: string } }[];
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  requestId?: string | null;
  /** Ruta del panel cuando la notificación no es de una solicitud */
  link?: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------- módulos y configuración
export type ModuleKey = 'intranet' | 'requests' | 'reports' | 'tasks' | 'attendance' | 'schedules' | 'leaves' | 'performance';

export interface AppSettings {
  modules: Record<string, boolean>;
  showIntranetOnLogin: boolean;
}

export interface SettingsOverview {
  catalog: { key: ModuleKey; label: string; description: string }[];
  global: AppSettings & { emailEnabled: boolean };
  companies: {
    id: string;
    name: string;
    slug: string;
    primaryColor: string;
    active: boolean;
    showIntranetOverride: boolean | null;
    moduleOverrides: Record<string, boolean>;
  }[];
}

// ---------------------------------------------------------------- tareas
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'DONE' | 'CANCELLED';

export interface Task {
  id: string;
  title: string;
  description?: string | null;
  areaId: string;
  area: { id: string; name: string; icon: string };
  assignee: UserBrief;
  assigneeId: string;
  createdBy: { id: string; name: string };
  priority: Priority;
  status: TaskStatus;
  dueDate: string | null;
  isOverdue: boolean;
  startedAt?: string | null;
  completedAt?: string | null;
  completionNote?: string | null;
  createdAt: string;
  permissions: { canEdit: boolean; canCancel: boolean; canReopen: boolean; canWork: boolean };
}

// ---------------------------------------------------------------- horarios
export type ScheduleMode = 'FIXED' | 'DAILY' | 'WEEKLY' | 'ROTATING';

export interface ShiftTemplate {
  id: string;
  areaId: string;
  name: string;
  startTime: string;
  endTime: string;
  color: string;
  isRest: boolean;
  active: boolean;
}

export interface ScheduleEntry {
  id: string;
  userId: string;
  areaId: string;
  date: string;
  templateId?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  isRest: boolean;
  note?: string | null;
  template?: { name: string; color: string } | null;
  area?: { id: string; name: string };
}

export interface LeaveSpan {
  id: string;
  userId?: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
}

export interface MySchedule {
  from: string;
  to: string;
  entries: ScheduleEntry[];
  leaves: LeaveSpan[];
}

export interface AreaSchedule {
  from: string;
  to: string;
  area: { id: string; name: string; scheduleMode: ScheduleMode };
  canEdit: boolean;
  templates: ShiftTemplate[];
  members: (UserBrief & { role: AreaRole })[];
  entries: ScheduleEntry[];
  leaves: LeaveSpan[];
}

// ---------------------------------------------------------------- asistencia
export interface AttendanceDay {
  date: string;
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  open: boolean;
  punctuality: string | null;
  earlyLeave: boolean;
  records: { id: string; type: 'CHECK_IN' | 'CHECK_OUT'; at: string; punctuality: string | null; deviationMinutes: number | null }[];
}

export interface AttendanceMe {
  nextType: 'CHECK_IN' | 'CHECK_OUT';
  openSince: string | null;
  today: string;
  schedule: { isRest: boolean; startTime: string | null; endTime: string | null } | null;
  todayRecords: AttendanceDay['records'];
  history: AttendanceDay[];
  pendingCode: { type: 'CHECK_IN' | 'CHECK_OUT'; expiresAt: string; resendAt: string; attemptsLeft: number } | null;
  config: { codeTtlMinutes: number; graceMinutes: number };
}

export interface AttendanceTeamRow {
  userId: string;
  name: string;
  avatarUrl?: string | null;
  jobTitle?: string | null;
  date: string;
  scheduled: { start: string | null; end: string | null } | null;
  leaveType: LeaveType | null;
  status: 'PRESENT' | 'LATE' | 'ABSENT' | 'LEAVE' | 'INCOMPLETE';
  firstIn: string | null;
  lastOut: string | null;
  workedMinutes: number;
  open: boolean;
  earlyLeave: boolean;
}

// ---------------------------------------------------------------- permisos
export type LeaveType = 'PERSONAL' | 'MEDICAL' | 'STUDY' | 'VACATION' | 'ILLNESS' | 'OTHER';
export type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export interface Leave {
  id: string;
  seq: number;
  code: string;
  type: LeaveType;
  status: LeaveStatus;
  startDate: string;
  endDate: string;
  paid: boolean | null;
  willReturn: boolean | null;
  departureTime?: string | null;
  returnTime?: string | null;
  description: string;
  additionalReason?: string | null;
  documents: FileValue[];
  decisionNote?: string | null;
  decidedAt?: string | null;
  createdAt: string;
  user: UserBrief;
  area?: { id: string; name: string } | null;
  decidedBy?: { id: string; name: string } | null;
  permissions: { canDecide: boolean; canCancel: boolean };
}

// ---------------------------------------------------------------- desempeño
export type KpiDirection = 'HIGHER_BETTER' | 'LOWER_BETTER';
export type KpiPeriod = 'DAILY' | 'WEEKLY' | 'MONTHLY';
export type KpiStatus = 'MET' | 'NEAR' | 'BELOW' | 'NONE';

export interface Kpi {
  id: string;
  roleId: string;
  name: string;
  description?: string | null;
  unit: string;
  target: number;
  direction: KpiDirection;
  period: KpiPeriod;
  active: boolean;
}

export interface KpiMeasureRow {
  id: string;
  kpiId: string;
  userId: string;
  periodStart: string;
  value: number;
  note?: string | null;
}

export interface KpiSummary {
  count: number;
  average: number | null;
  last: number | null;
  /** 1 = meta lograda */
  attainment: number | null;
  status: KpiStatus;
}

export interface KpiResult extends Kpi {
  measures: KpiMeasureRow[];
  summary: KpiSummary;
}

export interface CompanyTag {
  id: string;
  name: string;
  primaryColor: string;
}

export interface PerfCatalogTask {
  id: string;
  roleId: string;
  title: string;
  description?: string | null;
  active: boolean;
}

export interface PerfCatalogRole {
  id: string;
  positionId: string;
  name: string;
  description?: string | null;
  active: boolean;
  assignees: UserBrief[];
  kpis: Kpi[];
  tasks: PerfCatalogTask[];
}

export interface PerfCatalogPosition {
  id: string;
  areaId: string;
  name: string;
  description?: string | null;
  active: boolean;
  roles: PerfCatalogRole[];
}

export interface PerfCatalogArea {
  id: string;
  name: string;
  icon: string;
  isShared: boolean;
  canManage: boolean;
  companies: CompanyTag[];
  members: { role: AreaRole; user: UserBrief }[];
  positions: PerfCatalogPosition[];
}

export interface PerfTaskResult {
  id: string;
  title: string;
  description?: string | null;
  minutes: number;
  /** Minutos por id de empresa */
  byCompany: Record<string, number>;
}

/** Los KPI se miden por rol; el tiempo, por tarea del rol */
export interface PerfRoleBoard {
  id: string;
  name: string;
  kpis: KpiResult[];
  tasks: PerfTaskResult[];
  /** Cumplimiento promedio de los KPI medidos del rol (0–1) */
  score: number | null;
}

export interface PerfMe {
  from: string;
  to: string;
  /** Cumplimiento promedio de los KPI medidos (0–1) */
  score: number | null;
  totalMinutes: number;
  roles: (PerfRoleBoard & {
    position: { id: string; name: string };
    area: { id: string; name: string; icon: string; companies: CompanyTag[] };
  })[];
  entries: { id: string; date: string; minutes: number; note?: string | null; taskId: string; taskTitle: string; company: CompanyTag; loggedByOther: boolean }[];
}

export interface PerfTeamMember {
  user: UserBrief & { active: boolean };
  roles: (PerfRoleBoard & { positionName: string })[];
  totalMinutes: number;
  byCompany: Record<string, number>;
  score: number | null;
}

export interface PerfTeam {
  from: string;
  to: string;
  area: { id: string; name: string; icon: string; companies: CompanyTag[] };
  members: PerfTeamMember[];
  unassigned: (UserBrief & { active: boolean })[];
}

export interface PerfOverview {
  from: string;
  to: string;
  areas: PerfTeam[];
}
