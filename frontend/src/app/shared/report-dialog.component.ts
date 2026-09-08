import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { REPORT_REASONS } from '../core/mock-data';

@Component({
  selector: 'app-report-dialog',
  imports: [FormsModule],
  templateUrl: './report-dialog.component.html',
  styleUrl: './report-dialog.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReportDialogComponent {
  readonly postId = input<string>('');
  readonly submitted = input<boolean>(false);

  readonly dismissed = output<void>();
  readonly confirmed = output<string>();

  /** Static option list — not backend data. */
  readonly reasons = REPORT_REASONS;

  readonly MAX = 500;
  readonly category = signal(REPORT_REASONS[0]);
  readonly detail = signal('');
  readonly touched = signal(false);

  readonly reason = computed(() => `${this.category()}${this.detail().trim() ? ` — ${this.detail().trim()}` : ''}`);
  readonly error = computed(() =>
    this.touched() && this.reason().trim().length === 0 ? 'Tell us what is wrong with this post.' : null,
  );

  onCategory(value: string): void {
    this.category.set(value);
  }

  onDetail(value: string): void {
    this.detail.set(value);
  }

  submit(): void {
    this.touched.set(true);
    const reason = this.reason().trim();
    if (!reason || reason.length > this.MAX) {
      return;
    }
    this.confirmed.emit(reason);
  }
}
