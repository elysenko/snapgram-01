import { Injectable, inject } from '@angular/core';
import { AdminSetting } from '../../core/models';
import { ApiClient } from './api-client.service';

/** GET /api/admin/settings · PATCH /api/admin/settings */
@Injectable({ providedIn: 'root' })
export class AdminApi {
  private readonly api = inject(ApiClient);

  list(): Promise<AdminSetting[]> {
    return this.api.get<AdminSetting[]>('/admin/settings');
  }

  update(values: Record<string, string>): Promise<{ updated: string[] }> {
    return this.api.patch<{ updated: string[] }>('/admin/settings', values);
  }
}
