import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminSetting } from '../../core/models';
import { errorMessage } from '../../core/api-error';
import { AdminApi } from '../../shared/api/admin-api.service';

interface SettingGroup {
  key: string;
  label: string;
  items: AdminSetting[];
  configured: boolean;
}

@Component({
  selector: 'app-admin-settings',
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-settings.component.html',
  styleUrl: './admin-settings.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminSettingsComponent implements OnInit {
  private readonly adminApi = inject(AdminApi);

  /** GET /api/admin/settings — moderator-only; values arrive already masked. */
  readonly settings = signal<AdminSetting[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

  /** Keys edited since the last load — only these are sent on save. */
  private readonly dirty = new Map<string, string>();

  readonly bannerText =
    'The following need credentials to activate: S3-compatible object storage (AWS SDK v3 `@aws-sdk/client-s3`).';

  readonly groups = computed<SettingGroup[]>(() => {
    const order: string[] = [];
    const byKey = new Map<string, SettingGroup>();
    for (const item of this.settings()) {
      let group = byKey.get(item.group);
      if (!group) {
        group = { key: item.group, label: item.groupLabel, items: [], configured: true };
        byKey.set(item.group, group);
        order.push(item.group);
      }
      group.items.push(item);
      group.configured = group.configured && item.configured;
    }
    return order.map((key) => byKey.get(key)!);
  });

  readonly unconfigured = computed(() => this.settings().filter((item) => !item.configured));

  async ngOnInit(): Promise<void> {
    try {
      this.settings.set(await this.adminApi.list());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

  update(key: string, value: string): void {
    this.dirty.set(key, value);
    this.settings.update((items) =>
      items.map((item) => (item.key === key ? { ...item, value } : item)),
    );
    this.saved.set(false);
  }

  /**
   * PATCH /api/admin/settings. Only edited keys are sent, so re-saving the form
   * cannot overwrite a stored secret with the masked placeholder shown for it.
   */
  async save(): Promise<void> {
    this.error.set(null);
    const payload = Object.fromEntries(this.dirty);
    try {
      if (Object.keys(payload).length > 0) {
        await this.adminApi.update(payload);
        this.dirty.clear();
        this.settings.set(await this.adminApi.list());
      }
      this.saved.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }
}
