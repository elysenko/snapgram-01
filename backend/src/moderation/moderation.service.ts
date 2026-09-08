import { Injectable, NotFoundException } from '@nestjs/common';
import { ReportStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { PostSummary, USER_SELECT, UserSummary, toPostSummary, toUserSummary } from '../common/wire';

export interface ModerationReport {
  id: string;
  postId: string;
  post: PostSummary;
  reporter: UserSummary;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface RemovalResult {
  id: string;
  removedAt: string;
  reportsClosed: number;
}

@Injectable()
export class ModerationService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The moderation queue, newest first.
   *
   * Reports whose post was hard-deleted by its author are gone already via the
   * schema cascade, so the queue never shows orphans.
   */
  async listReports(status: ReportStatus = ReportStatus.open): Promise<ModerationReport[]> {
    const reports = await this.prisma.report.findMany({
      where: { status },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      include: {
        reporter: { select: USER_SELECT },
        post: { include: { author: { select: USER_SELECT } } },
      },
    });

    return reports.map((report) => ({
      id: report.id,
      postId: report.postId,
      post: toPostSummary(report.post, false),
      reporter: toUserSummary(report.reporter),
      reason: report.reason,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
    }));
  }

  /**
   * Soft-remove a post and close its open reports in one transaction.
   *
   * The row and the stored image survive deliberately — removal is reversible
   * and auditable, unlike the author's own hard delete. An already-removed post
   * keeps its original `removedAt` rather than having it refreshed.
   */
  async removePost(postId: string): Promise<RemovalResult> {
    const post = await this.prisma.post.findUnique({
      where: { id: postId },
      select: { id: true, removedAt: true },
    });
    if (!post) {
      throw new NotFoundException('No such post');
    }

    return this.prisma.$transaction(async (tx) => {
      const removedAt = post.removedAt ?? new Date();

      await tx.post.update({ where: { id: postId }, data: { removedAt } });

      const closed = await tx.report.updateMany({
        where: { postId, status: ReportStatus.open },
        data: { status: ReportStatus.closed },
      });

      return {
        id: postId,
        removedAt: removedAt.toISOString(),
        reportsClosed: closed.count,
      };
    });
  }
}
