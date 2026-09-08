import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { PostComment, PostSummary } from '../core/models';
import { AvatarComponent } from './avatar.component';

export interface NewComment {
  postId: string;
  text: string;
}

@Component({
  selector: 'app-post-card',
  imports: [RouterLink, FormsModule, AvatarComponent],
  templateUrl: './post-card.component.html',
  styleUrl: './post-card.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostCardComponent {
  readonly post = input.required<PostSummary>();
  /** Preview of the most recent comments, rendered under the caption. */
  readonly comments = input<PostComment[]>([]);
  readonly showCommentBox = input<boolean>(true);
  readonly linkToDetail = input<boolean>(true);

  readonly likeToggled = output<string>();
  readonly commentAdded = output<NewComment>();

  readonly draft = signal('');
  readonly captionExpanded = signal(false);

  readonly MAX_COMMENT = 500;

  readonly remaining = computed(() => this.MAX_COMMENT - this.draft().length);
  readonly canSubmit = computed(() => {
    const text = this.draft().trim();
    return text.length > 0 && text.length <= this.MAX_COMMENT;
  });

  readonly captionIsLong = computed(() => (this.post().caption ?? '').length > 120);

  onDraft(value: string): void {
    this.draft.set(value);
  }

  toggleLike(): void {
    this.likeToggled.emit(this.post().id);
  }

  expandCaption(): void {
    this.captionExpanded.set(true);
  }

  submit(): void {
    if (!this.canSubmit()) {
      return;
    }
    this.commentAdded.emit({ postId: this.post().id, text: this.draft().trim() });
    this.draft.set('');
  }
}
