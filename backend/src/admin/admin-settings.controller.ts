import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AdminSetting, AdminSettingsService } from './admin-settings.service';

@ApiTags('admin')
@ApiBearerAuth()
@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
export class AdminSettingsController {
  constructor(private readonly settings: AdminSettingsService) {}

  @Get()
  list(): Promise<AdminSetting[]> {
    return this.settings.list();
  }

  @Patch()
  update(@Body() body: Record<string, unknown>): Promise<{ updated: string[] }> {
    return this.settings.update(body);
  }
}
