import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AreasModule } from './areas/areas.module';
import { AuthModule, JwtAuthGuard, RolesGuard } from './auth/auth.module';
import { CompaniesModule } from './companies/companies.module';
import { FilesModule } from './files/files.module';
import { FormsModule } from './forms/forms.module';
import { MailModule } from './mail/mail.service';
import { NotificationsModule } from './notifications/notifications.module';
import { PrismaModule } from './prisma/prisma.service';
import { ReportsModule } from './reports/reports.module';
import { RequestsModule } from './requests/requests.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    PrismaModule,
    MailModule,
    AuthModule,
    CompaniesModule,
    AreasModule,
    UsersModule,
    FormsModule,
    RequestsModule,
    NotificationsModule,
    ReportsModule,
    FilesModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
