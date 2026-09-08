import { Role } from '@prisma/client';

/**
 * Wire contract shared with the Angular client (frontend/src/app/core/models.ts).
 * The frontend's UserRole union has no MANAGER member, so every role outside
 * ADMIN/MODERATOR is presented as USER.
 */
export type WireRole = 'USER' | 'MODERATOR' | 'ADMIN';

export function toWireRole(role: Role): WireRole {
  if (role === Role.ADMIN) return 'ADMIN';
  if (role === Role.MODERATOR) return 'MODERATOR';
  return 'USER';
}

/** Moderation privileges. ADMIN is the role Colossus always mints. */
export function isModerator(role: Role | WireRole): boolean {
  // Compared as a plain string so both the Prisma enum and the wire union work.
  const value = String(role);
  return value === 'ADMIN' || value === 'MODERATOR';
}

export interface UserLike {
  id: string;
  email: string;
  name: string | null;
  handle: string | null;
  displayName: string | null;
  bio: string | null;
  avatarUrl: string | null;
  role: Role;
  createdAt: Date;
}

export interface UserSummary {
  id: string;
  handle: string;
  displayName: string;
  avatarUrl: string | null;
  role: WireRole;
}

export interface SessionUser extends UserSummary {
  email: string;
  bio: string | null;
}

/**
 * `handle` and `displayName` are nullable in the database — the platform seed
 * creates accounts with only {email, name, role, passwordHash} — but the client
 * types them as required, so fall back rather than emit null.
 */
export function handleOf(user: Pick<UserLike, 'id' | 'handle'>): string {
  return user.handle ?? user.id;
}

export function displayNameOf(user: Pick<UserLike, 'id' | 'handle' | 'displayName' | 'name'>): string {
  return user.displayName ?? user.name ?? handleOf(user);
}

export function toUserSummary(user: UserLike): UserSummary {
  return {
    id: user.id,
    handle: handleOf(user),
    displayName: displayNameOf(user),
    avatarUrl: user.avatarUrl,
    role: toWireRole(user.role),
  };
}

export function toSessionUser(user: UserLike): SessionUser {
  return { ...toUserSummary(user), email: user.email, bio: user.bio };
}

/** Columns every user-shaped response selects. Never includes passwordHash. */
export const USER_SELECT = {
  id: true,
  email: true,
  name: true,
  handle: true,
  displayName: true,
  bio: true,
  avatarUrl: true,
  role: true,
  createdAt: true,
} as const;

export interface PostLike {
  id: string;
  authorId: string;
  imageKey: string;
  imageUrl: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  removedAt: Date | null;
  createdAt: Date;
  author: UserLike;
}

export interface PostSummary {
  id: string;
  authorId: string;
  author: UserSummary;
  imageUrl: string;
  caption: string | null;
  likeCount: number;
  commentCount: number;
  viewerHasLiked: boolean;
  removedAt: string | null;
  createdAt: string;
}

export function toPostSummary(post: PostLike, viewerHasLiked = false): PostSummary {
  return {
    id: post.id,
    authorId: post.authorId,
    author: toUserSummary(post.author),
    imageUrl: post.imageUrl,
    caption: post.caption,
    likeCount: post.likeCount,
    commentCount: post.commentCount,
    viewerHasLiked,
    removedAt: post.removedAt ? post.removedAt.toISOString() : null,
    createdAt: post.createdAt.toISOString(),
  };
}

export interface CommentLike {
  id: string;
  postId: string;
  text: string;
  createdAt: Date;
  author: UserLike;
}

export interface PostComment {
  id: string;
  postId: string;
  author: UserSummary;
  text: string;
  createdAt: string;
}

export function toComment(comment: CommentLike): PostComment {
  return {
    id: comment.id,
    postId: comment.postId,
    author: toUserSummary(comment.author),
    text: comment.text,
    createdAt: comment.createdAt.toISOString(),
  };
}
