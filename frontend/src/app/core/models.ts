/**
 * Wire models for the SnapGram API.
 * These mirror the backend response shapes exactly (see backend/src/common/wire.ts,
 * which is the single place those shapes are constructed). Every feature component
 * reads them from a real HTTP call through the `shared/api/*` services.
 */

export type UserRole = 'USER' | 'MODERATOR' | 'ADMIN';
export type ReportStatus = 'open' | 'closed';

export interface UserSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: UserRole;
}

export interface UserProfile extends UserSummary {
  /** Absent on public profiles — GET /api/users/:handle never exposes it. */
  email?: string;
  bio: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  /** True when the viewer is looking at their own profile. */
  isSelf?: boolean;
}

export interface PostSummary {
  id: string;
  author: UserSummary;
  imageUrl: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  removedAt: string | null;
  createdAt: string;
}

export type PostDetail = PostSummary;

export interface PostComment {
  id: string;
  postId: string;
  author: UserSummary;
  text: string;
  createdAt: string;
}

export interface Report {
  id: string;
  postId: string;
  post: PostSummary;
  reporter: UserSummary;
  reason: string;
  status: ReportStatus;
  createdAt: string;
}

export interface Paged<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AdminSetting {
  key: string;
  group: string;
  groupLabel: string;
  label: string;
  value: string;
  configured: boolean;
  hint: string;
}

/** The signed-in principal, hydrated from GET /api/auth/me. */
export interface SessionUser {
  id: string;
  email: string;
  handle: string;
  displayName: string;
  bio: string | null;
  avatarUrl: string | null;
  role: UserRole;
}
