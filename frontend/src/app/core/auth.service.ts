import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { SessionUser, UserRole } from './models';
import { readJson, removeRaw, writeJson, writeRaw } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

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

/** The account the preview session lands in when no explicit sign-in happened. */
const PREVIEW_SESSION: SessionUser = {
  id: 'usr_alice',
  email: 'alice@snapgram.app',
  handle: 'alice',
  displayName: 'Alice Nakamura',
  bio: 'Golden hour chaser. Film + digital. Tokyo → Lisbon.',
  avatarUrl: null,
  role: 'USER',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

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
   * Rehydrate from browser storage. Everything read here is untrusted: a bad
   * shape or unparseable value clears the keys and leaves the app signed out
   * rather than throwing during bootstrap and blanking the page.
   */
  private restore(): void {
    try {
      const stored = readJson<SessionUser>(USER_KEY, isSessionUser);
      if (stored) {
        this.user.set(stored);
      }
    } catch {
      this.clearSession();
    }
  }

  private persist(user: SessionUser): void {
    this.user.set(user);
    writeJson(USER_KEY, user);
    writeRaw(TOKEN_KEY, 'session');
  }

  private clearSession(): void {
    this.user.set(null);
    removeRaw(USER_KEY);
    removeRaw(TOKEN_KEY);
  }

  /**
   * Sign in.
   *
   * In the static preview there is no API server, so credentials resolve
   * locally and synchronously — a well-formed submission always succeeds and
   * lands on the feed. The production branch is the real HTTP call, which the
   * service layer fills in; `COLOSSUS_PREVIEW` is a build-time constant, so the
   * preview branch is dead-code-eliminated from the production bundle.
   */
  login(email: string, password: string, returnUrl?: string | null): string | null {
    if (COLOSSUS_PREVIEW) {
      const problem = validateCredentials(email, password);
      if (problem) {
        return problem;
      }
      const handle = email.split('@')[0].replace(/[^a-z0-9._]/gi, '').toLowerCase() || 'member';
      this.persist({
        ...PREVIEW_SESSION,
        id: `usr_${handle}`,
        email: email.trim(),
        handle,
        displayName: toDisplayName(handle),
        role: handle === 'mod' ? 'ADMIN' : 'USER',
      });
      void this.router.navigateByUrl(returnUrl || '/feed');
      return null;
    }

    // Production: POST /api/auth/login, persist the JWT, hydrate from /api/auth/me.
    return null;
  }

  signup(
    displayName: string,
    email: string,
    password: string,
    returnUrl?: string | null,
  ): string | null {
    if (COLOSSUS_PREVIEW) {
      const problem = validateCredentials(email, password);
      if (problem) {
        return problem;
      }
      if (!displayName.trim()) {
        return 'Enter a display name.';
      }
      const handle = email.split('@')[0].replace(/[^a-z0-9._]/gi, '').toLowerCase() || 'member';
      this.persist({
        id: `usr_${handle}`,
        email: email.trim(),
        handle,
        displayName: displayName.trim(),
        bio: null,
        avatarUrl: null,
        role: 'USER',
      });
      void this.router.navigateByUrl(returnUrl || '/feed');
      return null;
    }

    // Production: POST /api/auth/signup.
    return null;
  }

  /**
   * Preview-only shortcut: seeds the same signed-in state the login form would
   * produce, with no credentials involved, so every authenticated screen is
   * reachable from the login page.
   */
  previewSignIn(role: UserRole = 'USER'): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    const existing = this.user();
    if (existing) {
      if (role !== 'USER' && existing.role === 'USER') {
        this.persist({ ...existing, role });
      }
      return;
    }
    this.persist(role === 'USER' ? PREVIEW_SESSION : { ...PREVIEW_SESSION, role });
  }

  /** Preview-only helper used by the account screen to preview the moderator UI. */
  previewSetRole(role: UserRole): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    const existing = this.user() ?? PREVIEW_SESSION;
    this.persist({ ...existing, role });
  }

  updateProfile(patch: Partial<Pick<SessionUser, 'displayName' | 'bio' | 'avatarUrl'>>): void {
    const existing = this.user();
    if (!existing) {
      return;
    }
    this.persist({ ...existing, ...patch });
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/explore');
  }
}

function validateCredentials(email: string, password: string): string | null {
  if (!email.trim() || !password) {
    return 'Enter your email and password.';
  }
  if (!/^[^@\s]+@[^@\s]+$/.test(email.trim())) {
    return 'That email address does not look right.';
  }
  if (password.length < 8) {
    return 'Password must be at least 8 characters.';
  }
  return null;
}

function toDisplayName(handle: string): string {
  return handle.charAt(0).toUpperCase() + handle.slice(1);
}
