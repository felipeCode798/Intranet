import { Type } from 'class-transformer';
import {
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class AttachmentDto {
  @IsString() fileName: string;
  @IsString() url: string;
  @IsOptional() @IsString() mimeType?: string;
  @IsOptional() @IsNumber() size?: number;
}

export class CreateRequestDto {
  @IsString() formId: string;
  @IsString() @MinLength(4, { message: 'El asunto debe tener al menos 4 caracteres' }) subject: string;
  @IsObject() data: Record<string, unknown>;
  @IsOptional() @IsIn(['LOW', 'MEDIUM', 'HIGH', 'URGENT']) priority?: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  /** Solo para usuarios sin empresa (p. ej. superadministrador) */
  @IsOptional() @IsString() companyId?: string;
}

export class AssignDto {
  @IsString() assigneeId: string;
  @IsOptional() @IsString() note?: string;
}

export class EscalateDto {
  @IsIn(['USER', 'AREA']) targetType: 'USER' | 'AREA';
  @IsOptional() @IsString() targetUserId?: string;
  @IsOptional() @IsString() targetAreaId?: string;
  @IsString() @MinLength(10, { message: 'Explica con al menos 10 caracteres por qué no puedes atenderla' }) reason: string;
}

export class TransferDto {
  @IsString() areaId: string;
  @IsString() @MinLength(5, { message: 'Explica el motivo del traslado' }) note: string;
  /** Días hábiles adicionales sobre el vencimiento actual (opcional) */
  @IsOptional() @IsInt() @Min(0) @Max(60) extraDays?: number;
}

export class NoteDto {
  @IsString() @MinLength(3, { message: 'Escribe un mensaje' }) note: string;
}

export class RespondDto {
  @IsString() @MinLength(5, { message: 'Escribe la respuesta' }) responseText: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}

export class CommentDto {
  @IsString() @MinLength(1) message: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => AttachmentDto) attachments?: AttachmentDto[];
}

export interface ListQuery {
  scope?: 'mine' | 'assigned' | 'area' | 'all';
  status?: string;
  areaId?: string;
  companyId?: string;
  priority?: string;
  overdue?: string;
  q?: string;
  page?: string;
  pageSize?: string;
}
