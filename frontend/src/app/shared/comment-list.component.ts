import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PostComment } from '../core/models';
import { AvatarComponent } from './avatar.component';

@Component({
  selector: 'app-comment-list',
  imports: [RouterLink, FormsModule, AvatarComponent],
  templateUrl: './comment-list.component.html',
  styleUrl: './comment-list.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommentListComponent {
  readonly comments = input<PostComment[]>([]);
  readonly canModerate = input<boolean>(false);
  readonly currentHandle = input<string>('');

  readonly added = output<string>();
  readonly removed = output<string>();

  readonly MAX = 500;
  readonly draft = signal('');
  readonly touched = signal(false);

  readonly trimmed = computed(() => this.draft().trim());
  readonly remaining = computed(() => this.MAX - this.draft().length);
  readonly error = computed(() => {
    if (!this.touched()) {
      return null;
    }
    if (this.trimmed().length === 0) {
      return 'Comment cannot be empty.';
    }
    if (this.trimmed().length > this.MAX) {
      return `Comments are limited to ${this.MAX} characters.`;
    }
    return null;
  });

  canDelete(comment: PostComment): boolean {
    return this.canModerate() || comment.author.handle === this.currentHandle();
  }

  onDraft(value: string): void {
    this.draft.set(value);
  }

  submit(): void {
    this.touched.set(true);
    const text = this.trimmed();
    if (!text || text.length > this.MAX) {
      return;
    }
    this.added.emit(text);
    this.draft.set('');
    this.touched.set(false);
  }
}
