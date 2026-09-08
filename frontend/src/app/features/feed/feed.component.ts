import { ChangeDetectionStrategy, Component, OnInit, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PostComment, PostSummary } from '../../core/models';
import { errorMessage } from '../../core/api-error';
import { CommentsApi } from '../../shared/api/comments-api.service';
import { FEED_PAGE_SIZE, PostsApi } from '../../shared/api/posts-api.service';
import { NewComment, PostCardComponent } from '../../shared/post-card.component';

const PAGE_SIZE = FEED_PAGE_SIZE;
/** Inline comment previews shown under each card. */
const PREVIEW_COMMENTS = 2;

@Component({
  selector: 'app-feed',
  imports: [RouterLink, PostCardComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedComponent implements OnInit {
  private readonly router = inject(Router);
  private readonly postsApi = inject(PostsApi);
  private readonly commentsApi = inject(CommentsApi);

  /** GET /api/posts/feed?cursor=&limit=10 — authors the member follows. */
  readonly posts = signal<PostSummary[]>([]);
  /** GET /api/posts/:id/comments for the posts currently on screen. */
  readonly comments = signal<PostComment[]>([]);

  readonly loading = signal(true);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

  /** Keyset cursor for the next page; null once the feed is exhausted. */
  private readonly nextCursor = signal<string | null>(null);
  /** Post ids whose comment preview has already been fetched. */
  private readonly hydrated = new Set<string>();

  /** ?limit= keeps the number of loaded pages in the URL so reload restores it. */
  readonly limit = input<string | undefined>(undefined);

  /** Set by "Load more"; until then the page count comes from ?limit=. */
  private readonly requested = signal<number | null>(null);

  /** Pages restored from the URL, so a reload of /feed?limit=20 shows 20 posts. */
  private readonly loaded = computed(() => {
    const manual = this.requested();
    if (manual !== null) {
      return manual;
    }
    const raw = Number(this.limit());
    if (!Number.isFinite(raw) || raw <= 0) {
      return PAGE_SIZE;
    }
    return Math.max(PAGE_SIZE, Math.ceil(raw / PAGE_SIZE) * PAGE_SIZE);
  });

  readonly visible = computed(() => this.posts().slice(0, this.loaded()));
  readonly hasMore = computed(() => this.loaded() < this.posts().length || this.nextCursor() !== null);
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.posts().length === 0);
  readonly followingCount = computed(() => new Set(this.posts().map((post) => post.author.handle)).size);
  readonly skeletons = [0, 1, 2];

  async ngOnInit(): Promise<void> {
    try {
      // A deep link such as /feed?limit=30 restores every page it names, so the
      // URL alone reproduces the scroll depth the member had.
      await this.fetchUntil(this.loaded());
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
      void this.hydrateComments();
    }
  }

  commentsFor(postId: string): PostComment[] {
    return this.comments().filter((comment) => comment.postId === postId).slice(0, PREVIEW_COMMENTS);
  }

  async loadMore(): Promise<void> {
    const next = this.loaded() + PAGE_SIZE;
    if (this.posts().length < next && this.nextCursor()) {
      this.loadingMore.set(true);
      try {
        await this.fetchUntil(next);
      } catch (error) {
        this.error.set(errorMessage(error));
      } finally {
        this.loadingMore.set(false);
      }
    }
    this.requested.set(next);
    void this.router.navigate([], { queryParams: { limit: next }, replaceUrl: true });
    void this.hydrateComments();
  }

  /** POST /api/posts/:id/like — optimistic, reconciled with the server count. */
  async toggleLike(postId: string): Promise<void> {
    const before = this.posts();
    this.applyLike(postId, (post) => ({
      viewerHasLiked: !post.viewerHasLiked,
      likeCount: Math.max(0, post.likeCount + (post.viewerHasLiked ? -1 : 1)),
    }));
    try {
      const result = await this.postsApi.toggleLike(postId);
      this.applyLike(postId, () => ({ viewerHasLiked: result.liked, likeCount: result.likeCount }));
    } catch (error) {
      this.posts.set(before);
      this.error.set(errorMessage(error));
    }
  }

  /** POST /api/posts/:id/comments */
  async addComment(event: NewComment): Promise<void> {
    try {
      const created = await this.commentsApi.create(event.postId, event.text);
      this.comments.update((comments) => [...comments, created]);
      this.bumpCommentCount(event.postId, 1);
    } catch (error) {
      this.error.set(errorMessage(error));
    }
  }

  /** Pull pages until `target` posts are held or the feed runs out. */
  private async fetchUntil(target: number): Promise<void> {
    let cursor = this.posts().length === 0 ? null : this.nextCursor();
    while (this.posts().length < target) {
      const page = await this.postsApi.feed(cursor, PAGE_SIZE);
      this.posts.update((posts) => [...posts, ...page.items]);
      this.nextCursor.set(page.nextCursor);
      cursor = page.nextCursor;
      if (!cursor) {
        break;
      }
    }
  }

  /**
   * Fetch the inline comment preview for newly visible posts only. Posts with
   * no comments are skipped outright, so a quiet feed costs zero extra calls.
   */
  private async hydrateComments(): Promise<void> {
    const pending = this.visible().filter((post) => post.commentCount > 0 && !this.hydrated.has(post.id));
    for (const post of pending) {
      this.hydrated.add(post.id);
    }
    const pages = await Promise.all(
      pending.map((post) =>
        this.commentsApi.list(post.id, PREVIEW_COMMENTS).catch(() => ({ items: [], nextCursor: null })),
      ),
    );
    const fetched = pages.flatMap((page) => page.items);
    if (fetched.length) {
      this.comments.update((comments) => [...comments, ...fetched]);
    }
  }

  private applyLike(postId: string, patch: (post: PostSummary) => Partial<PostSummary>): void {
    this.posts.update((posts) =>
      posts.map((post) => (post.id === postId ? { ...post, ...patch(post) } : post)),
    );
  }

  private bumpCommentCount(postId: string, delta: number): void {
    this.posts.update((posts) =>
      posts.map((post) =>
        post.id === postId ? { ...post, commentCount: Math.max(0, post.commentCount + delta) } : post,
      ),
    );
  }

}
