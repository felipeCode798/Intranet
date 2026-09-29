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
  createdAt: string;
}
