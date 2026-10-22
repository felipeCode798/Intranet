import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AreasModule } from './areas/areas.module';
import { AttendanceModule } from './attendance/attendance.module';
import { AuthModule, JwtAuthGuard, RolesGuard } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { FilesModule } from './files/files.module';
import { FormsModule } from './forms/forms.module';
import { LeavesModule } from './leaves/leaves.module';
import { MailModule } from './mail/mail.service';
import { NoticeModule } from './notice/notice.module';
import { NotificationsModule } from './notifications/notifications.module';
import { PerformanceModule } from './performance/performance.module';
import { PrismaModule } from './prisma/prisma.service';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { SchedulesModule } from './schedules/schedules.module';
import { ModuleGuard, SettingsModule } from './settings/settings.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    NoticeModule,
    SettingsModule,
    AuthModule,
    CompaniesModule,
    AreasModule,
    UsersModule,
    FormsModule,
    RequestsModule,
    NotificationsModule,
    ReportsModule,
    FilesModule,
    TasksModule,
    SchedulesModule,
    AttendanceModule,
    LeavesModule,
    PerformanceModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ModuleGuard },
  ],
})
export class AppModule {}
