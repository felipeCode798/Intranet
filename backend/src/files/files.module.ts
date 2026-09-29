import { BadRequestException, Controller, Module, Post, UploadedFiles, UseInterceptors } from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { randomUUID } from 'crypto';
import { mkdirSync } from 'fs';
import { diskStorage } from 'multer';
import { extname, join } from 'path';

const UPLOAD_DIR = join(process.cwd(), process.env.UPLOAD_DIR || 'uploads');
mkdirSync(UPLOAD_DIR, { recursive: true });

const BLOCKED = /\.(exe|bat|cmd|sh|ps1|msi|com|scr|js|vbs)$/i;

/**
 * Subida de archivos (adjuntos de solicitudes e imágenes de la intranet).
 * Devuelve la metadata que luego se envía en el cuerpo de la solicitud o de la empresa.
 */
@Controller('files')
export class FilesController {
  @Post()
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      storage: diskStorage({
        destination: UPLOAD_DIR,
        filename: (_req, file, cb) => cb(null, `${randomUUID()}${extname(file.originalname).toLowerCase()}`),
      }),
      limits: { fileSize: 20 * 1024 * 1024 },
      fileFilter: (_req, file, cb) =>
        BLOCKED.test(file.originalname) ? cb(new BadRequestException('Tipo de archivo no permitido'), false) : cb(null, true),
    }),
  )
  upload(@UploadedFiles() files: { originalname: string; filename: string; mimetype: string; size: number }[]) {
    if (!files?.length) throw new BadRequestException('No se recibió ningún archivo');
    return files.map((f) => ({
      // multer entrega el nombre en latin1; lo normalizamos a UTF-8 para tildes y eñes
      fileName: Buffer.from(f.originalname, 'latin1').toString('utf8'),
      url: `/uploads/${f.filename}`,
      mimeType: f.mimetype,
      size: f.size,
    }));
  }
}

@Module({ controllers: [FilesController] })
export class FilesModule {}
