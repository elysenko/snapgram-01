import { ChangeDetectionStrategy, Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AdminSetting } from '../../core/models';
import { MOCK_ADMIN_SETTINGS } from '../../core/mock-data';

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
export class AdminSettingsComponent {
  /** Backend data — GET /api/admin/settings */
  readonly settings = signal<AdminSetting[]>([...MOCK_ADMIN_SETTINGS]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly saved = signal(false);

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

  update(key: string, value: string): void {
    this.settings.update((items) =>
      items.map((item) => (item.key === key ? { ...item, value } : item)),
    );
    this.saved.set(false);
  }

  save(): void {
    this.settings.update((items) =>
      items.map((item) => (item.value.trim() ? { ...item, configured: true } : item)),
    );
    this.saved.set(true);
  }
}
