import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Page, cursorWhereAsc, encodeCursor } from '../common/pagination';
import { PostComment, USER_SELECT, isModerator, toComment } from '../common/wire';
import type { AuthUser } from '../auth/auth.types';
import { CreateCommentDto } from './dto/create-comment.dto';

const COMMENT_INCLUDE = { author: { select: USER_SELECT } } as const;
export const COMMENT_PAGE_SIZE = 20;

@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Comments live and die with their post — a removed post has no thread. */
  private async requireLivePost(postId: string): Promise<void> {
    const post = await this.prisma.post.findFirst({
      where: { id: postId, removedAt: null },
      select: { id: true },
    });
    if (!post) {
      throw new NotFoundException('No such post');
    }
  }

  /** Oldest-first so a thread reads top to bottom as it grew. */
  async list(postId: string, cursor?: string, limit = COMMENT_PAGE_SIZE): Promise<Page<PostComment>> {
    await this.requireLivePost(postId);

    const rows = await this.prisma.comment.findMany({
      where: { postId, ...cursorWhereAsc(cursor) },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: limit + 1,
      include: COMMENT_INCLUDE,
    });

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];

    return {
      items: page.map(toComment),
      nextCursor: hasMore && last ? encodeCursor(last.createdAt, last.id) : null,
    };
  }

  /**
   * Add a comment and re-derive the post's counter in the same transaction, so
   * `commentCount` can never disagree with the number of rows.
   */
  async create(postId: string, authorId: string, dto: CreateCommentDto): Promise<PostComment> {
    await this.requireLivePost(postId);

    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.create({
        data: { postId, authorId, text: dto.text },
        include: COMMENT_INCLUDE,
      });

      const commentCount = await tx.comment.count({ where: { postId } });
      await tx.post.update({ where: { id: postId }, data: { commentCount } });

      return toComment(comment);
    });
  }

  /**
   * Delete a comment. Permitted for its author, the author of the post it sits
   * on, and moderators — anyone else gets 403 and the row stays put.
   */
  async remove(id: string, viewer: AuthUser): Promise<{ deleted: true; id: string }> {
    const comment = await this.prisma.comment.findUnique({
      where: { id },
      include: { post: { select: { id: true, authorId: true } } },
    });
    if (!comment) {
      throw new NotFoundException('No such comment');
    }

    const allowed =
      comment.authorId === viewer.id ||
      comment.post.authorId === viewer.id ||
      isModerator(viewer.role);
    if (!allowed) {
      throw new ForbiddenException('You cannot delete this comment');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.comment.delete({ where: { id } });
      const commentCount = await tx.comment.count({ where: { postId: comment.postId } });
      await tx.post.update({ where: { id: comment.postId }, data: { commentCount } });
    });

    return { deleted: true, id };
  }
}
