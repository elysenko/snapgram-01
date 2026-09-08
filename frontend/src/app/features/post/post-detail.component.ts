import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PostComment, PostDetail, UserProfile } from '../../core/models';
import { MOCK_ALL_POSTS, MOCK_COMMENTS, MOCK_PROFILES } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { CommentListComponent } from '../../shared/comment-list.component';
import { FollowButtonComponent } from '../../shared/follow-button.component';
import { ReportDialogComponent } from '../../shared/report-dialog.component';

@Component({
  selector: 'app-post-detail',
  imports: [RouterLink, FormsModule, AvatarComponent, CommentListComponent, FollowButtonComponent, ReportDialogComponent],
  templateUrl: './post-detail.component.html',
  styleUrl: './post-detail.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostDetailComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Route params / query params, bound by withComponentInputBinding(). */
  readonly postId = input<string>('');
  readonly modal = input<string | undefined>(undefined);

  /** Backend data — GET /api/posts/:id */
  readonly posts = signal<PostDetail[]>([...MOCK_ALL_POSTS]);
  /** Backend data — GET /api/posts/:id/comments */
  readonly comments = signal<PostComment[]>([...MOCK_COMMENTS]);
  /** Backend data — GET /api/users/:handle for the author panel. */
  readonly profiles = signal<UserProfile[]>([...MOCK_PROFILES]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly reportSubmitted = signal(false);
  readonly editing = signal(false);
  readonly captionDraft = signal('');
  readonly deleted = signal(false);

  readonly post = computed(() => this.posts().find((item) => item.id === this.postId()) ?? null);
  readonly missing = computed(() => !this.loading() && (this.deleted() || this.post() === null || this.post()!.removedAt !== null));
  readonly postComments = computed(() => this.comments().filter((comment) => comment.postId === this.postId()));
  readonly authorProfile = computed(() => {
    const handle = this.post()?.author.handle;
    return this.profiles().find((profile) => profile.handle === handle) ?? null;
  });
  readonly isOwnPost = computed(() => this.post()?.author.handle === this.auth.currentUser()?.handle);
  readonly reportOpen = computed(() => this.modal() === 'report');

  openReport(): void {
    this.reportSubmitted.set(false);
    void this.router.navigate([], { queryParams: { modal: 'report' }, replaceUrl: false });
  }

  closeReport(): void {
    void this.router.navigate([], { queryParams: { modal: null }, replaceUrl: true });
  }

  confirmReport(_reason: string): void {
    this.reportSubmitted.set(true);
  }

  toggleLike(): void {
    const id = this.postId();
    this.posts.update((posts) =>
      posts.map((post) =>
        post.id === id
          ? { ...post, viewerHasLiked: !post.viewerHasLiked, likeCount: post.likeCount + (post.viewerHasLiked ? -1 : 1) }
          : post,
      ),
    );
  }

  toggleFollow(next: boolean): void {
    const handle = this.post()?.author.handle;
    this.profiles.update((profiles) =>
      profiles.map((profile) =>
        profile.handle === handle
          ? { ...profile, viewerFollows: next, followerCount: profile.followerCount + (next ? 1 : -1) }
          : profile,
      ),
    );
  }

  addComment(text: string): void {
    const user = this.auth.currentUser();
    this.comments.update((comments) => [
      ...comments,
      {
        id: `cmt_local_${comments.length + 1}`,
        postId: this.postId(),
        author: {
          id: user?.id ?? 'usr_me',
          handle: user?.handle ?? 'you',
          displayName: user?.displayName ?? 'You',
          avatarUrl: user?.avatarUrl ?? null,
          role: user?.role ?? 'USER',
        },
        text,
        createdAt: 'now',
      },
    ]);
    this.bumpCommentCount(1);
  }

  removeComment(commentId: string): void {
    this.comments.update((comments) => comments.filter((comment) => comment.id !== commentId));
    this.bumpCommentCount(-1);
  }

  startEdit(): void {
    this.captionDraft.set(this.post()?.caption ?? '');
    this.editing.set(true);
  }

  onCaptionDraft(value: string): void {
    this.captionDraft.set(value);
  }

  saveCaption(): void {
    const id = this.postId();
    const caption = this.captionDraft().trim();
    this.posts.update((posts) => posts.map((post) => (post.id === id ? { ...post, caption } : post)));
    this.editing.set(false);
  }

  deletePost(): void {
    this.deleted.set(true);
  }

  private bumpCommentCount(delta: number): void {
    const id = this.postId();
    this.posts.update((posts) =>
      posts.map((post) => (post.id === id ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post)),
    );
  }
}
