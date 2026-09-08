import { Injectable, inject } from '@angular/core';
import { Paged, PostSummary } from '../../core/models';
import { timeAgo } from '../../core/time';
import { ApiClient } from './api-client.service';

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

export const FEED_PAGE_SIZE = 10;
export const EXPLORE_PAGE_SIZE = 24;

/**
 * GET  /api/posts/feed | /explore | /by/:handle | /:id
 * POST /api/posts (multipart) · PATCH /api/posts/:id · DELETE /api/posts/:id
 * POST /api/posts/:id/like
 *
 * `createdAt` arrives as ISO-8601 and is folded to the compact relative label
 * the card and detail templates were designed around.
 */
@Injectable({ providedIn: 'root' })
export class PostsApi {
  private readonly api = inject(ApiClient);

  async feed(cursor?: string | null, limit = FEED_PAGE_SIZE): Promise<Paged<PostSummary>> {
    return this.page(await this.api.get<Paged<PostSummary>>('/posts/feed', { cursor, limit }));
  }

  async explore(cursor?: string | null, limit = EXPLORE_PAGE_SIZE): Promise<Paged<PostSummary>> {
    return this.page(await this.api.get<Paged<PostSummary>>('/posts/explore', { cursor, limit }));
  }

  async byAuthor(handle: string, cursor?: string | null, limit = EXPLORE_PAGE_SIZE): Promise<Paged<PostSummary>> {
    const path = `/posts/by/${encodeURIComponent(handle)}`;
    return this.page(await this.api.get<Paged<PostSummary>>(path, { cursor, limit }));
  }

  async findOne(id: string): Promise<PostSummary> {
    return decoratePost(await this.api.get<PostSummary>(`/posts/${encodeURIComponent(id)}`));
  }

  async create(image: File, caption: string): Promise<PostSummary> {
    const form = new FormData();
    form.append('image', image, image.name);
    if (caption.trim()) {
      form.append('caption', caption.trim());
    }
    return decoratePost(await this.api.upload<PostSummary>('POST', '/posts', form));
  }

  async updateCaption(id: string, caption: string): Promise<PostSummary> {
    return decoratePost(await this.api.patch<PostSummary>(`/posts/${encodeURIComponent(id)}`, { caption }));
  }

  remove(id: string): Promise<unknown> {
    return this.api.delete(`/posts/${encodeURIComponent(id)}`);
  }

  toggleLike(id: string): Promise<LikeResult> {
    return this.api.post<LikeResult>(`/posts/${encodeURIComponent(id)}/like`);
  }

  private page(response: Paged<PostSummary>): Paged<PostSummary> {
    return { items: (response.items ?? []).map(decoratePost), nextCursor: response.nextCursor ?? null };
  }
}

export function decoratePost(post: PostSummary): PostSummary {
  return { ...post, createdAt: timeAgo(post.createdAt) };
}
