import { Injectable, inject } from '@angular/core';
import { Paged, PostComment } from '../../core/models';
import { timeAgo } from '../../core/time';
import { ApiClient } from './api-client.service';

export const COMMENT_PAGE_SIZE = 20;

/**
 * GET  /api/posts/:id/comments
 * POST /api/posts/:id/comments
 * DELETE /api/comments/:id
 */
@Injectable({ providedIn: 'root' })
export class CommentsApi {
  private readonly api = inject(ApiClient);

  async list(postId: string, limit = COMMENT_PAGE_SIZE, cursor?: string | null): Promise<Paged<PostComment>> {
    const path = `/posts/${encodeURIComponent(postId)}/comments`;
    const page = await this.api.get<Paged<PostComment>>(path, { cursor, limit });
    return { items: (page.items ?? []).map(decorateComment), nextCursor: page.nextCursor ?? null };
  }

  async create(postId: string, text: string): Promise<PostComment> {
    const path = `/posts/${encodeURIComponent(postId)}/comments`;
    return decorateComment(await this.api.post<PostComment>(path, { text }));
  }

  remove(commentId: string): Promise<unknown> {
    return this.api.delete(`/comments/${encodeURIComponent(commentId)}`);
  }
}

export function decorateComment(comment: PostComment): PostComment {
  return { ...comment, createdAt: timeAgo(comment.createdAt) };
}
