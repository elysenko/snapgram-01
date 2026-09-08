import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionUser } from './models';
import { TOKEN_KEY, USER_KEY, readJson, readRaw, removeRaw, writeJson, writeRaw } from './storage';
import { errorMessage } from './api-error';
import { AuthApi } from '../shared/api/auth-api.service';
import { UsersApi } from '../shared/api/users-api.service';

function isSessionUser(value: unknown): value is SessionUser {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as Partial<SessionUser>;
  return (
    typeof candidate.id === 'string' &&
    typeof candidate.email === 'string' &&
    typeof candidate.handle === 'string' &&
    typeof candidate.displayName === 'string' &&
    (candidate.role === 'USER' || candidate.role === 'MODERATOR' || candidate.role === 'ADMIN')
  );
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly usersApi = inject(UsersApi);

  private readonly user = signal<SessionUser | null>(null);

  readonly currentUser = this.user.asReadonly();
  readonly isAuthenticated = computed(() => this.user() !== null);
  readonly isModerator = computed(() => {
    const role = this.user()?.role;
    return role === 'ADMIN' || role === 'MODERATOR';
  });

  constructor() {
    this.restore();
  }

  /**
   * Rehydrate from browser storage, then re-verify against the API.
   *
   * Storage is the synchronous source so guards resolve on the first tick
   * without a round trip; GET /api/auth/me then confirms the token is still
   * valid and refreshes the profile, and a rejection clears the session.
   */
  private restore(): void {
    try {
      const stored = readJson<SessionUser>(USER_KEY, isSessionUser);
      if (stored) {
        this.user.set(stored);
      }
    } catch {
      this.clearSession();
      return;
    }

    if (!readRaw(TOKEN_KEY)) {
      return;
    }

    void this.authApi
      .me()
      .then((user) => this.persistUser(user))
      // A 401 has already cleared storage in the interceptor; mirror that here
      // so the in-memory signal cannot outlive the token.
      .catch(() => this.clearSession());
  }

  private persist(user: SessionUser, token: string): void {
    writeRaw(TOKEN_KEY, token);
    this.persistUser(user);
  }

  private persistUser(user: SessionUser): void {
    this.user.set(user);
    writeJson(USER_KEY, user);
  }

  private clearSession(): void {
    this.user.set(null);
    removeRaw(USER_KEY);
    removeRaw(TOKEN_KEY);
  }

  /**
   * Sign in. Resolves to an error string for the form banner, or null on
   * success (in which case the caller has already been navigated onward).
   *
   */
  async login(email: string, password: string, returnUrl?: string | null): Promise<string | null> {
    const problem = validateLogin(email, password);
    if (problem) {
      return problem;
    }

    try {
      const result = await this.authApi.login(email.trim(), password);
      this.persist(result.user, result.accessToken);
      await this.router.navigateByUrl(returnUrl || '/feed');
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  async signup(
    displayName: string,
    email: string,
    password: string,
    returnUrl?: string | null,
  ): Promise<string | null> {
    const problem = validateCredentials(email, password) ?? (displayName.trim() ? null : 'Enter a display name.');
    if (problem) {
      return problem;
    }

    try {
      const result = await this.authApi.signup(displayName.trim(), email.trim(), password);
      this.persist(result.user, result.accessToken);
      await this.router.navigateByUrl(returnUrl || '/feed');
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /**
   * PATCH /api/users/me. Scoped to the caller's own token server-side, which is
   * what guarantees another member's profile cannot be touched from here.
   */
  async saveProfile(patch: { displayName: string; bio: string | null }): Promise<string | null> {
    try {
      const updated = await this.usersApi.updateMe({
        displayName: patch.displayName,
        bio: patch.bio ?? '',
      });
      this.persistUser(updated);
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /** PUT /api/users/me/avatar. Returns an error string for the form banner. */
  async saveAvatar(file: File): Promise<string | null> {
    try {
      this.persistUser(await this.usersApi.uploadAvatar(file));
      return null;
    } catch (error) {
      return errorMessage(error);
    }
  }

  /** In-memory patch for optimistic UI updates. */
  applyLocalProfile(patch: Partial<Pick<SessionUser, 'displayName' | 'bio' | 'avatarUrl'>>): void {
    const existing = this.user();
    if (!existing) {
      return;
    }
    this.persistUser({ ...existing, ...patch });
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/explore');
  }

  /**
   * Preview-only local sign-in for the `Skip login/signup — Demo Mode` shortcut on the
   * auth screens (mockup→product identity contract: the UI mockup review approved this
   * affordance, so it stays wired through to the shipped product). It fabricates a
   * session entirely in the browser — no credentials, no network call — and is gated by
   * the build-time `COLOSSUS_PREVIEW` constant, which esbuild folds to `false` in every
   * real deployment, so this branch never runs outside the mockup preview build.
   */
  previewSignIn(): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    this.persist(
      {
        id: 'preview-member',
        email: 'preview-member@preview.local',
        handle: 'preview',
        displayName: 'Preview Member',
        bio: null,
        avatarUrl: null,
        role: 'USER',
      },
      'preview-mode-local-session',
    );
  }
}

/**
 * Sign-in precheck. Deliberately does NOT enforce a minimum password length:
 * the platform mints the demo credentials and we cannot assume they satisfy
 * our own signup rule — rejecting them client-side would make those accounts
 * unusable without the server ever being asked.
 */
function validateLogin(email: string, password: string): string | null {
  if (!email.trim() || !password) {
    return 'Enter your email and password.';
  }
  if (!/^[^@\s]+@[^@\s]+$/.test(email.trim())) {
    return 'That email address does not look right.';
  }
  return null;
}

/** Sign-up precheck, mirroring the backend's SignupDto rules. */
function validateCredentials(email: string, password: string): string | null {
  const problem = validateLogin(email, password);
  if (problem) {
    return problem;
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

