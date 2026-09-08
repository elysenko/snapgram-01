import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { PostComment, PostDetail, UserProfile } from '../../core/models';
import { errorMessage, toApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { CommentsApi } from '../../shared/api/comments-api.service';
import { PostsApi } from '../../shared/api/posts-api.service';
import { ReportsApi } from '../../shared/api/reports-api.service';
import { UsersApi } from '../../shared/api/users-api.service';
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
  private readonly postsApi = inject(PostsApi);
  private readonly commentsApi = inject(CommentsApi);
  private readonly usersApi = inject(UsersApi);
  private readonly reportsApi = inject(ReportsApi);
  readonly auth = inject(AuthService);

  /** Route params / query params, bound by withComponentInputBinding(). */
  readonly postId = input<string>('');
  readonly modal = input<string | undefined>(undefined);

  /** GET /api/posts/:id */
  readonly posts = signal<PostDetail[]>([]);
  /** GET /api/posts/:id/comments */
  readonly comments = signal<PostComment[]>([]);
  /** GET /api/users/:handle for the author panel (carries viewerFollows). */
  readonly profiles = signal<UserProfile[]>([]);

  readonly loading = signal(true);
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

  /** Last id loaded, so the router reusing this component refetches. */
  private loadedId = '';

  constructor() {
    // The router reuses the component instance across /p/a → /p/b, so the load
    // is driven by the id input rather than by ngOnInit alone.
    effect(() => {
      const id = this.postId();
      if (id && id !== this.loadedId) {
        this.loadedId = id;
        void this.load(id);
      }
    });
  }

  private async load(id: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.deleted.set(false);
    try {
      const post = await this.postsApi.findOne(id);
      this.posts.set([post]);
      const [page, profile] = await Promise.all([
        this.commentsApi.list(id, 100).catch(() => ({ items: [] as PostComment[], nextCursor: null })),
        this.usersApi.getProfile(post.author.handle).catch(() => null),
      ]);
      this.comments.set(page.items);
      this.profiles.set(profile ? [profile] : []);
    } catch (error) {
      const failure = toApiError(error);
      // A deleted or moderator-removed post is the "no longer available" state
      // the design already renders — not an error banner.
      if (failure.status === 404) {
        this.posts.set([]);
      } else {
        this.error.set(failure.message);
      }
    } finally {
      this.loading.set(false);
    }
  }

  openReport(): void {
    this.reportSubmitted.set(false);
    void this.router.navigate([], { queryParams: { modal: 'report' }, replaceUrl: false });
  }

  closeReport(): void {
    void this.router.navigate([], { queryParams: { modal: null }, replaceUrl: true });
  }

  /** POST /api/posts/:id/report */
  async confirmReport(reason: string): Promise<void> {
    try {
      await this.reportsApi.create(this.postId(), reason);
      this.reportSubmitted.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
      this.closeReport();
    }
  }

  /** POST /api/posts/:id/like */
  async toggleLike(): Promise<void> {
    const id = this.postId();
    const before = this.posts();
    this.patchPost(id, (post) => ({
      viewerHasLiked: !post.viewerHasLiked,
      likeCount: Math.max(0, post.likeCount + (post.viewerHasLiked ? -1 : 1)),
    }));
    try {
      const result = await this.postsApi.toggleLike(id);
      this.patchPost(id, () => ({ viewerHasLiked: result.liked, likeCount: result.likeCount }));
    } catch (error) {
      this.posts.set(before);
      this.error.set(errorMessage(error));
    }
  }

  /** POST | DELETE /api/users/:handle/follow */
  async toggleFollow(next: boolean): Promise<void> {
    const handle = this.post()?.author.handle;
    if (!handle) {
      return;
    }
    const before = this.profiles();
    this.patchProfile(handle, (profile) => ({
      viewerFollows: next,
      followerCount: Math.max(0, profile.followerCount + (next ? 1 : -1)),
    }));
    try {
      const result = next ? await this.usersApi.follow(handle) : await this.usersApi.unfollow(handle);
      this.patchProfile(handle, () => ({
        viewerFollows: result.following,
        followerCount: result.followerCount,
      }));
    } catch (error) {
      this.profiles.set(before);
      this.error.set(errorMessage(error));
    }
  }

  /** POST /api/posts/:id/comments */
  async addComment(text: string): Promise<void> {
    try {
      const created = await this.commentsApi.create(this.postId(), text);
      this.comments.update((comments) => [...comments, created]);
      this.bumpCommentCount(1);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  /** DELETE /api/comments/:id — allowed for the comment author or a moderator. */
  async removeComment(commentId: string): Promise<void> {
    const before = this.comments();
    this.comments.update((comments) => comments.filter((comment) => comment.id !== commentId));
    this.bumpCommentCount(-1);
    try {
      await this.commentsApi.remove(commentId);
    } catch (error) {
      this.comments.set(before);
      this.bumpCommentCount(1);
      this.error.set(errorMessage(error));
    }
  }

  startEdit(): void {
    this.captionDraft.set(this.post()?.caption ?? '');
    this.editing.set(true);
  }

  onCaptionDraft(value: string): void {
    this.captionDraft.set(value);
  }

  /** PATCH /api/posts/:id — 403 for anyone but the author. */
  async saveCaption(): Promise<void> {
    const id = this.postId();
    const caption = this.captionDraft().trim();
    try {
      const updated = await this.postsApi.updateCaption(id, caption);
      this.patchPost(id, () => ({ caption: updated.caption }));
      this.editing.set(false);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  /** DELETE /api/posts/:id — hard delete, cascading likes and comments. */
  async deletePost(): Promise<void> {
    try {
      await this.postsApi.remove(this.postId());
      this.deleted.set(true);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  private patchPost(id: string, patch: (post: PostDetail) => Partial<PostDetail>): void {
    this.posts.update((posts) => posts.map((post) => (post.id === id ? { ...post, ...patch(post) } : post)));
  }

  private patchProfile(handle: string, patch: (profile: UserProfile) => Partial<UserProfile>): void {
    this.profiles.update((profiles) =>
      profiles.map((profile) => (profile.handle === handle ? { ...profile, ...patch(profile) } : profile)),
    );
  }


  private bumpCommentCount(delta: number): void {
    this.patchPost(this.postId(), (post) => ({ commentCount: Math.max(0, post.commentCount + delta) }));
  }
}
