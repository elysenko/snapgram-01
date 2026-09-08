import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs/operators';
import { AuthService } from './core/auth.service';
import { AvatarComponent } from './shared/avatar.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, RouterLink, RouterLinkActive, AvatarComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  private readonly router = inject(Router);
  readonly auth = inject(AuthService);

  readonly menuOpen = signal(false);

  private readonly url = toSignal(
    this.router.events.pipe(
      filter((event): event is NavigationEnd => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  /** Auth screens render without the app chrome. */
  readonly bare = computed(() => /^\/(login|signup)\b/.test(this.url()));

  readonly profileLink = computed(() => `/u/${this.auth.currentUser()?.handle ?? 'alice'}`);

  /** The moderation queue is moderator-only; the API answers 403 either way. */
  readonly showModeration = computed(() => this.auth.isModerator());

  toggleMenu(): void {
    this.menuOpen.update((open) => !open);
  }

  closeMenu(): void {
    this.menuOpen.set(false);
  }

  signOut(): void {
    this.closeMenu();
    this.auth.logout();
  }
}
