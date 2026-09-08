import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateReportDto } from './dto/create-report.dto';

export interface ReportReceipt {
  id: string;
  postId: string;
  status: ReportStatus;
  createdAt: string;
  message: string;
}

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * File a report against a live post.
   *
   * `upsert` on the unique (postId, reporterId) pair makes a repeat report by
   * the same member update their reason instead of surfacing a unique-constraint
   * 500 — the queue keeps exactly one row per reporter per post.
   */
  async create(postId: string, reporterId: string, dto: CreateReportDto): Promise<ReportReceipt> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, removedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('No such post');
    }

    // `status` is re-asserted on update, not just on create. A moderator closing
    // the queue entry must not permanently silence this reporter: if they report
    // the post again, the row belongs back in the open queue.
    const report = await this.prisma.report.upsert({
      where: { postId_reporterId: { postId, reporterId } },
      update: { reason: dto.reason, status: ReportStatus.open },
      create: { postId, reporterId, reason: dto.reason, status: ReportStatus.open },
    });

    return {
      id: report.id,
      postId: report.postId,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      message: 'Thanks — this post has been reported to the moderators.',
    };
  }
}
