import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Report, ReportStatus } from '../../core/models';
import { MOCK_REPORTS } from '../../core/mock-data';
import { AvatarComponent } from '../../shared/avatar.component';

@Component({
  selector: 'app-moderation',
  imports: [RouterLink, AvatarComponent],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationComponent {
  private readonly router = inject(Router);

  /** Backend data — GET /api/moderation/reports?status=open|closed */
  readonly reports = signal<Report[]>([...MOCK_REPORTS]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly notice = signal<string | null>(null);

  readonly status = input<string | undefined>(undefined);
  readonly panel = input<string | undefined>(undefined);

  readonly activeStatus = computed<ReportStatus>(() => (this.status() === 'closed' ? 'closed' : 'open'));
  readonly visible = computed(() => this.reports().filter((report) => report.status === this.activeStatus()));
  readonly openCount = computed(() => this.reports().filter((report) => report.status === 'open').length);
  readonly closedCount = computed(() => this.reports().filter((report) => report.status === 'closed').length);
  readonly selected = computed(() => this.reports().find((report) => report.id === this.panel()) ?? null);
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.visible().length === 0);

  setStatus(status: ReportStatus): void {
    void this.router.navigate([], { queryParams: { status, panel: null }, replaceUrl: true });
  }

  openPanel(reportId: string): void {
    void this.router.navigate([], {
      queryParams: { status: this.activeStatus(), panel: reportId },
      replaceUrl: false,
    });
  }

  closePanel(): void {
    void this.router.navigate([], { queryParams: { panel: null }, queryParamsHandling: 'merge', replaceUrl: true });
  }

  /** Optimistically closes the row: soft-removes the post and closes its reports. */
  removePost(report: Report): void {
    this.reports.update((reports) =>
      reports.map((item) =>
        item.postId === report.postId
          ? { ...item, status: 'closed' as ReportStatus, post: { ...item.post, removedAt: 'just now' } }
          : item,
      ),
    );
    this.notice.set(`Post ${report.postId} removed — it is now hidden from feed, explore and profiles.`);
    this.closePanel();
  }

  dismissReport(report: Report): void {
    this.reports.update((reports) =>
      reports.map((item) => (item.id === report.id ? { ...item, status: 'closed' as ReportStatus } : item)),
    );
    this.notice.set(`Report ${report.id} closed with no action taken.`);
    this.closePanel();
  }

  clearNotice(): void {
    this.notice.set(null);
  }
}
