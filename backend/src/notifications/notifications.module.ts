import { Controller, Get, Module, Param, Post, Query } from '@nestjs/common';
import { AuthUser } from '../common/auth-user';
import { CurrentUser } from '../common/decorators';
import { PrismaService } from '../prisma/prisma.service';

/** Notificaciones internas (campana del panel) */
@Controller('notifications')
export class NotificationsController {
  constructor(private prisma: PrismaService) {}

  @Get()
  async list(@CurrentUser() u: AuthUser, @Query('unread') unread?: string, @Query('take') take?: string) {
    const [items, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where: { userId: u.id, ...(unread === 'true' ? { read: false } : {}) },
        orderBy: { createdAt: 'desc' },
        take: Math.min(100, Number(take) || 30),
      }),
      this.prisma.notification.count({ where: { userId: u.id, read: false } }),
    ]);
    return { items, unreadCount };
  }

  @Post('read-all')
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
    return { ok: true };
  }

  @Post(':id/read')
  async read(@CurrentUser() u: AuthUser, @Param('id') id: string) {
    await this.prisma.notification.updateMany({ where: { id, userId: u.id }, data: { read: true } });
    return { ok: true };
  }
}

@Module({ controllers: [NotificationsController] })
export class NotificationsModule {}
