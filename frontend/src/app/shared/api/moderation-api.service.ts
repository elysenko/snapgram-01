import { Injectable, inject } from '@angular/core';
import { Report, ReportStatus } from '../../core/models';
import { timeAgo } from '../../core/time';
import { ApiClient } from './api-client.service';
import { decoratePost } from './posts-api.service';

export interface RemovalResult {
  id: string;
  removedAt: string;
  reportsClosed: number;
}

/**
 * GET  /api/moderation/reports?status=open|closed
 * POST /api/moderation/posts/:id/remove
 *
 * Both are moderator-only: an anonymous caller gets 401 and a member gets 403,
 * which is what keeps the queue off a member's screen even by direct URL.
 */
@Injectable({ providedIn: 'root' })
export class ModerationApi {
  private readonly api = inject(ApiClient);

  async listReports(status: ReportStatus): Promise<Report[]> {
    const reports = await this.api.get<Report[]>('/moderation/reports', { status });
    return (reports ?? []).map((report) => ({
      ...report,
      createdAt: timeAgo(report.createdAt),
      post: decoratePost(report.post),
    }));
  }

  removePost(postId: string): Promise<RemovalResult> {
    return this.api.post<RemovalResult>(`/moderation/posts/${encodeURIComponent(postId)}/remove`);
  }
}
