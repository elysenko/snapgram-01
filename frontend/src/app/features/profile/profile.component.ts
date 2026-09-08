import { ChangeDetectionStrategy, Component, computed, effect, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PostSummary, UserProfile, UserSummary } from '../../core/models';
import { errorMessage, toApiError } from '../../core/api-error';
import { AuthService } from '../../core/auth.service';
import { PostsApi } from '../../shared/api/posts-api.service';
import { UsersApi } from '../../shared/api/users-api.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { FollowButtonComponent } from '../../shared/follow-button.component';
import { PostGridComponent } from '../../shared/post-grid.component';

type ProfileTab = 'posts' | 'followers' | 'following';

/** Profile grids are capped at one page; the design has no "load more" here. */
const GRID_PAGE_SIZE = 24;

@Component({
  selector: 'app-profile',
  imports: [RouterLink, AvatarComponent, FollowButtonComponent, PostGridComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly router = inject(Router);
  private readonly usersApi = inject(UsersApi);
  private readonly postsApi = inject(PostsApi);
  readonly auth = inject(AuthService);

  readonly handle = input<string>('');
  readonly tab = input<string | undefined>(undefined);

  /** GET /api/users/:handle */
  readonly profiles = signal<UserProfile[]>([]);
  /** GET /api/posts/by/:handle — newest first, removed posts already excluded. */
  readonly posts = signal<PostSummary[]>([]);
  /** GET /api/users/:handle/followers */
  readonly followers = signal<UserSummary[]>([]);
  /** GET /api/users/:handle/following */
  readonly following = signal<UserSummary[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private loadedHandle = '';

  readonly profile = computed(() => this.profiles().find((item) => item.handle === this.handle()) ?? null);
  readonly missing = computed(() => !this.loading() && !this.error() && this.profile() === null);
  readonly isOwn = computed(() => this.handle() === this.auth.currentUser()?.handle);

  readonly activeTab = computed<ProfileTab>(() => {
    const value = this.tab();
    return value === 'followers' || value === 'following' ? value : 'posts';
  });

  readonly authorPosts = computed(() =>
    this.posts().filter((post) => post.author.handle === this.handle() && post.removedAt === null),
  );

  constructor() {
    // Driven by the handle input so /u/alice → /u/bob refetches even though the
    // router reuses this component instance.
    effect(() => {
      const handle = this.handle();
      if (handle && handle !== this.loadedHandle) {
        this.loadedHandle = handle;
        void this.load(handle);
      }
    });
  }

  private async load(handle: string): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    try {
      const profile = await this.usersApi.getProfile(handle);
      this.profiles.set([profile]);
      const [posts, followers, following] = await Promise.all([
        this.postsApi.byAuthor(handle, null, GRID_PAGE_SIZE).catch(() => ({ items: [], nextCursor: null })),
        this.usersApi.listFollowers(handle).catch(() => [] as UserSummary[]),
        this.usersApi.listFollowing(handle).catch(() => [] as UserSummary[]),
      ]);
      this.posts.set(posts.items);
      this.followers.set(followers);
      this.following.set(following);
    } catch (error) {
      const failure = toApiError(error);
      // 404 is the "no member with that handle" state the design renders.
      if (failure.status === 404) {
        this.profiles.set([]);
      } else {
        this.error.set(failure.message);
      }
    } finally {
      this.loading.set(false);
    }
  }

  select(tab: ProfileTab): void {
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  /** POST | DELETE /api/users/:handle/follow */
  async toggleFollow(next: boolean): Promise<void> {
    const handle = this.handle();
    const before = this.profiles();
    this.patch(handle, (profile) => ({
      viewerFollows: next,
      followerCount: Math.max(0, profile.followerCount + (next ? 1 : -1)),
    }));
    try {
      const result = next ? await this.usersApi.follow(handle) : await this.usersApi.unfollow(handle);
      this.patch(handle, () => ({ viewerFollows: result.following, followerCount: result.followerCount }));
      this.followers.set(await this.usersApi.listFollowers(handle).catch(() => this.followers()));
    } catch (error) {
      this.profiles.set(before);
      this.error.set(errorMessage(error));
    }
  }

  private patch(handle: string, patch: (profile: UserProfile) => Partial<UserProfile>): void {
    this.profiles.update((profiles) =>
      profiles.map((profile) => (profile.handle === handle ? { ...profile, ...patch(profile) } : profile)),
    );
  }
}
