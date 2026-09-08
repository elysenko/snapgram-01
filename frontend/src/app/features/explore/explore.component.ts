import { ChangeDetectionStrategy, Component, OnInit, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostSummary } from '../../core/models';
import { errorMessage } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { EXPLORE_PAGE_SIZE, PostsApi } from '../../shared/api/posts-api.service';
import { PostGridComponent } from '../../shared/post-grid.component';

@Component({
  selector: 'app-explore',
  imports: [RouterLink, PostGridComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreComponent implements OnInit {
  private readonly postsApi = inject(PostsApi);
  readonly auth = inject(AuthService);

  /** GET /api/posts/explore?limit=24 — public, no token required. */
  readonly posts = signal<PostSummary[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.posts().length === 0);
  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  readonly totalLikes = computed(() => this.posts().reduce((sum, post) => sum + post.likeCount, 0));
  readonly photographers = computed(() => new Set(this.posts().map((post) => post.author.handle)).size);

  async ngOnInit(): Promise<void> {
    try {
      const page = await this.postsApi.explore(null, EXPLORE_PAGE_SIZE);
      this.posts.set(page.items);
    } catch (error) {
      this.error.set(errorMessage(error));
    } finally {
      this.loading.set(false);
    }
  }
}
