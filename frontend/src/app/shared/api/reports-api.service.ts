import { Injectable, inject } from '@angular/core';
import { ReportStatus } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface ReportReceipt {
  id: string;
  postId: string;
  status: ReportStatus;
  createdAt: string;
  message: string;
}

/** POST /api/posts/:id/report */
@Injectable({ providedIn: 'root' })
export class ReportsApi {
  private readonly api = inject(ApiClient);

  create(postId: string, reason: string): Promise<ReportReceipt> {
    return this.api.post<ReportReceipt>(`/posts/${encodeURIComponent(postId)}/report`, { reason });
  }
}
