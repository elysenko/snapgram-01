/**
 * Wire models for the SnapGram API.
 * These mirror the backend response shapes exactly; the service layer replaces
 * the mock signal initialisers in the feature components with real calls that
 * return these types.
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
  email: string;
  bio: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
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
