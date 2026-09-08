import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { Report, ReportStatus } from '../../core/models';
import { errorMessage } from '../../core/api-error';
import { ModerationApi } from '../../shared/api/moderation-api.service';
import { AvatarComponent } from '../../shared/avatar.component';

@Component({
  selector: 'app-moderation',
  imports: [RouterLink, AvatarComponent],
  templateUrl: './moderation.component.html',
  styleUrl: './moderation.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModerationComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly moderationApi = inject(ModerationApi);

  /** GET /api/moderation/reports?status=open|closed — moderator-only (403 otherwise). */
  readonly reports = signal<Report[]>([]);

  readonly loading = signal(true);
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

  async ngOnInit(): Promise<void> {
    await this.reload();
  }

  /**
   * Both queues are fetched together: the tab counts in the header are derived
   * from one array, so loading only the active status would show "0 closed"
   * until the member clicked through.
   */
  private async reload(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const [open, closed] = await Promise.all([
        this.moderationApi.listReports('open'),
        this.moderationApi.listReports('closed'),
      ]);
      this.reports.set([...open, ...closed]);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }

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

  /**
   * POST /api/moderation/posts/:id/remove — soft-removes the post and closes
   * every open report against it in one transaction. The row is closed
   * optimistically and reconciled from the server on the reload below.
   */
  async removePost(report: Report): Promise<void> {
    const before = this.reports();
    this.markClosed((item) => item.postId === report.postId, true);
    this.notice.set(`Post ${report.postId} removed — it is now hidden from feed, explore and profiles.`);
    this.closePanel();
    try {
      await this.moderationApi.removePost(report.postId);
      await this.reload();
    } catch (error) {
      this.reports.set(before);
      this.notice.set(null);
      this.error.set(errorMessage(error));
    }
  }

  /**
   * Closes the report locally without touching the post. There is no dismiss
   * endpoint — the queue only exposes removal — so this is a reviewer-side
   * acknowledgement that does not survive a reload.
   */
  dismissReport(report: Report): void {
    this.markClosed((item) => item.id === report.id, false);
    this.notice.set(`Report ${report.id} closed with no action taken.`);
    this.closePanel();
  }

  clearNotice(): void {
    this.notice.set(null);
  }

  private markClosed(match: (report: Report) => boolean, removePost: boolean): void {
    this.reports.update((reports) =>
      reports.map((item) =>
        match(item)
          ? {
              ...item,
              status: 'closed' as ReportStatus,
              post: removePost ? { ...item.post, removedAt: 'just now' } : item.post,
            }
          : item,
      ),
    );
  }
}
