import { Injectable, inject } from '@angular/core';
import { SessionUser, UserProfile, UserSummary } from '../../core/models';
import { ApiClient } from './api-client.service';

export interface FollowResult {
  following: boolean;
  followerCount: number;
}

/**
 * GET  /api/users/:handle              — public profile (+ viewerFollows)
 * GET  /api/users/:handle/followers
 * GET  /api/users/:handle/following
 * PATCH /api/users/me                  — display name / bio
 * PUT  /api/users/me/avatar            — multipart avatar
 * POST|DELETE /api/users/:handle/follow
 */
@Injectable({ providedIn: 'root' })
export class UsersApi {
  private readonly api = inject(ApiClient);

  getProfile(handle: string): Promise<UserProfile> {
    return this.api.get<UserProfile>(`/users/${encodeURIComponent(handle)}`);
  }

  listFollowers(handle: string): Promise<UserSummary[]> {
    return this.api.get<UserSummary[]>(`/users/${encodeURIComponent(handle)}/followers`);
  }

  listFollowing(handle: string): Promise<UserSummary[]> {
    return this.api.get<UserSummary[]>(`/users/${encodeURIComponent(handle)}/following`);
  }

  updateMe(patch: { displayName?: string; bio?: string }): Promise<SessionUser> {
    return this.api.patch<SessionUser>('/users/me', patch);
  }

  uploadAvatar(file: File): Promise<SessionUser> {
    const form = new FormData();
    form.append('avatar', file, file.name);
    return this.api.upload<SessionUser>('PUT', '/users/me/avatar', form);
  }

  follow(handle: string): Promise<FollowResult> {
    return this.api.post<FollowResult>(`/users/${encodeURIComponent(handle)}/follow`);
  }

  unfollow(handle: string): Promise<FollowResult> {
    return this.api.delete<FollowResult>(`/users/${encodeURIComponent(handle)}/follow`);
  }
}
