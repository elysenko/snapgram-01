import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ReportStatus } from '@prisma/client';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { ReportQueryDto } from './dto/report-query.dto';
import { ModerationReport, ModerationService, RemovalResult } from './moderation.service';

/**
 * Moderator-only surface.
 *
 * JwtAuthGuard runs first so an anonymous caller gets 401; RolesGuard then
 * answers 403 for an authenticated member. ADMIN is the role Colossus always
 * mints, MODERATOR is accepted for parity with the client's role union.
 */
@ApiTags('moderation')
@ApiBearerAuth()
@Controller('moderation')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN', 'MODERATOR')
export class ModerationController {
  constructor(private readonly moderation: ModerationService) {}

  @Get('reports')
  listReports(@Query() query: ReportQueryDto): Promise<ModerationReport[]> {
    return this.moderation.listReports(query.status ?? ReportStatus.open);
  }

  @Post('posts/:id/remove')
  @HttpCode(HttpStatus.OK)
  removePost(@Param('id') id: string): Promise<RemovalResult> {
    return this.moderation.removePost(id);
  }
}
