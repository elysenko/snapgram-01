import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AdminSettingsModule } from './admin/admin-settings.module';
import { AuthModule } from './auth/auth.module';
import { CommentsModule } from './comments/comments.module';
import { FollowsModule } from './follows/follows.module';
import { HealthModule } from './health/health.module';
import { AppConfigModule } from './lib/config.module';
import { ModerationModule } from './moderation/moderation.module';
import { PostsModule } from './posts/posts.module';
import { PrismaModule } from './prisma/prisma.module';
import { ReportsModule } from './reports/reports.module';
import { StorageModule } from './storage/storage.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    // PrismaModule and AppConfigModule are @Global — every feature module below
    // gets PrismaService and ConfigResolver without importing them.
    PrismaModule,
    AppConfigModule,
    StorageModule,
    AuthModule,
    UsersModule,
    FollowsModule,
    PostsModule,
    CommentsModule,
    ReportsModule,
    ModerationModule,
    AdminSettingsModule,
    HealthModule,
  ],
})
export class AppModule {}
