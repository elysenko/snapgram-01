import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PostSummary } from '../../core/models';
import { MOCK_EXPLORE_POSTS } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { PostGridComponent } from '../../shared/post-grid.component';

@Component({
  selector: 'app-explore',
  imports: [RouterLink, PostGridComponent],
  templateUrl: './explore.component.html',
  styleUrl: './explore.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ExploreComponent {
  readonly auth = inject(AuthService);

  /** Backend data — GET /api/posts/explore?limit=24 */
  readonly posts = signal<PostSummary[]>([...MOCK_EXPLORE_POSTS]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  readonly isEmpty = computed(() => !this.loading() && !this.error() && this.posts().length === 0);
  readonly skeletons = Array.from({ length: 12 }, (_, i) => i);

  readonly totalLikes = computed(() => this.posts().reduce((sum, post) => sum + post.likeCount, 0));
  readonly photographers = computed(() => new Set(this.posts().map((post) => post.author.handle)).size);
}
