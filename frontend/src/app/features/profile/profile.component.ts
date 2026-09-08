import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { PostSummary, UserProfile, UserSummary } from '../../core/models';
import { MOCK_ALL_POSTS, MOCK_PEOPLE, MOCK_PROFILES } from '../../core/mock-data';
import { AuthService } from '../../core/auth.service';
import { AvatarComponent } from '../../shared/avatar.component';
import { FollowButtonComponent } from '../../shared/follow-button.component';
import { PostGridComponent } from '../../shared/post-grid.component';

type ProfileTab = 'posts' | 'followers' | 'following';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, AvatarComponent, FollowButtonComponent, PostGridComponent],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly handle = input<string>('');
  readonly tab = input<string | undefined>(undefined);

  /** Backend data — GET /api/users/:handle */
  readonly profiles = signal<UserProfile[]>([...MOCK_PROFILES]);
  /** Backend data — the author's newest-first grid. */
  readonly posts = signal<PostSummary[]>([...MOCK_ALL_POSTS]);
  /** Backend data — GET /api/users/:handle?tab=followers|following */
  readonly people = signal<UserSummary[]>([...MOCK_PEOPLE]);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

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

  readonly followers = computed(() => this.people().filter((person) => person.handle !== this.handle()).slice(0, 4));
  readonly following = computed(() => this.people().filter((person) => person.handle !== this.handle()).slice(1, 4));

  select(tab: ProfileTab): void {
    void this.router.navigate([], { queryParams: { tab }, replaceUrl: true });
  }

  toggleFollow(next: boolean): void {
    const handle = this.handle();
    this.profiles.update((profiles) =>
      profiles.map((profile) =>
        profile.handle === handle
          ? { ...profile, viewerFollows: next, followerCount: profile.followerCount + (next ? 1 : -1) }
          : profile,
      ),
    );
  }
}
