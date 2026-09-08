import { Body, Controller, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CreateReportDto } from './dto/create-report.dto';
import { ReportReceipt, ReportsService } from './reports.service';

@ApiTags('reports')
@Controller('posts')
export class ReportsController {
  constructor(private readonly reports: ReportsService) {}

  @Post(':id/report')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id') postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateReportDto,
  ): Promise<ReportReceipt> {
    return this.reports.create(postId, user.id, dto);
  }
}
