import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PostComment, PostSummary } from '../../core/models';
import { MOCK_COMMENTS, MOCK_FEED_POSTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { NewComment, PostCardComponent } from '../../shared/post-card.component';

const PAGE_SIZE = 10;

@Component({
  selector: 'app-feed',
  imports: [RouterLink, PostCardComponent],
  templateUrl: './feed.component.html',
  styleUrl: './feed.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FeedComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  /** Backend data — GET /api/posts/feed?cursor=&limit=10 */
  readonly posts = signal<PostSummary[]>([...MOCK_FEED_POSTS]);
  /** Backend data — GET /api/posts/:id/comments for the visible posts. */
  readonly comments = signal<PostComment[]>([...MOCK_COMMENTS]);

  readonly loading = signal(false);
  readonly loadingMore = signal(false);
  readonly error = signal<string | null>(null);

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
  readonly hasMore = computed(() => this.loaded() < this.posts().length);
  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.posts().length === 0);
  readonly followingCount = computed(() => new Set(this.posts().map((post) => post.author.handle)).size);
  readonly skeletons = [0, 1, 2];

  commentsFor(postId: string): PostComment[] {
    return this.comments().filter((comment) => comment.postId === postId).slice(0, 2);
  }

  loadMore(): void {
    const next = this.loaded() + PAGE_SIZE;
    this.requested.set(next);
    void this.router.navigate([], { queryParams: { limit: next }, replaceUrl: true });
  }

  toggleLike(postId: string): void {
    this.posts.update((posts) =>
      posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              viewerHasLiked: !post.viewerHasLiked,
              likeCount: post.likeCount + (post.viewerHasLiked ? -1 : 1),
            }
          : post,
      ),
    );
  }

  addComment(event: NewComment): void {
    const user = this.auth.currentUser();
    this.comments.update((comments) => [
      ...comments,
      {
        id: `cmt_local_${comments.length + 1}`,
        postId: event.postId,
        author: {
          id: user?.id ?? 'usr_me',
          handle: user?.handle ?? 'you',
          displayName: user?.displayName ?? 'You',
          avatarUrl: user?.avatarUrl ?? null,
          role: user?.role ?? 'USER',
        },
        text: event.text,
        createdAt: 'now',
      },
    ]);
    this.posts.update((posts) =>
      posts.map((post) => (post.id === event.postId ? { ...post, commentCount: post.commentCount + 1 } : post)),
    );
  }
}
