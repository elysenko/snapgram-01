import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { UsersService } from '../users/users.service';
import { validateImageUpload } from '../common/image-validation';
import { Page, cursorWhere, toPage } from '../common/pagination';
import { PostSummary, USER_SELECT, toPostSummary } from '../common/wire';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';

export const FEED_PAGE_SIZE = 10;
export const EXPLORE_PAGE_SIZE = 24;

/** Every post read joins its author; one shape, one place to change it. */
const POST_INCLUDE = { author: { select: USER_SELECT } } as const;

export interface LikeResult {
  liked: boolean;
  likeCount: number;
}

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly users: UsersService,
  ) {}

  /**
   * Resolve a live post or 404.
   *
   * Soft-removed posts are indistinguishable from missing ones on every read
   * path — that is what makes moderator removal effective rather than cosmetic.
   */
  private async findLiveOrFail(id: string) {
    const post = await this.prisma.post.findFirst({
      where: { id, removedAt: null },
      include: POST_INCLUDE,
    });
    if (!post) {
      throw new NotFoundException('No such post');
    }
    return post;
  }

  /** Which of these posts has the viewer liked? One query, not N. */
  private async likedIds(postIds: string[], viewerId?: string): Promise<Set<string>> {
    if (!viewerId || postIds.length === 0) {
      return new Set();
    }
    const likes = await this.prisma.like.findMany({
      where: { userId: viewerId, postId: { in: postIds } },
      select: { postId: true },
    });
    return new Set(likes.map((like) => like.postId));
  }

  private async decorate(
    posts: Array<Parameters<typeof toPostSummary>[0]>,
    viewerId?: string,
  ): Promise<PostSummary[]> {
    const liked = await this.likedIds(
      posts.map((post) => post.id),
      viewerId,
    );
    return posts.map((post) => toPostSummary(post, liked.has(post.id)));
  }

  /**
   * Create a post.
   *
   * Validation runs to completion before the object is stored and the object is
   * stored before the row is written, so a rejected upload leaves neither a
   * stray S3 object nor a Post row behind.
   */
  async create(
    authorId: string,
    dto: CreatePostDto,
    file?: Express.Multer.File,
  ): Promise<PostSummary> {
    const { mime, ext } = validateImageUpload(file);

    const key = this.storage.postKey(ext);
    await this.storage.putObject(key, file!.buffer, mime);

    try {
      const post = await this.prisma.post.create({
        data: {
          authorId,
          imageKey: key,
          imageUrl: this.storage.publicUrl(key),
          caption: dto.caption && dto.caption.length > 0 ? dto.caption : null,
        },
        include: POST_INCLUDE,
      });
      return toPostSummary(post, false);
    } catch (error) {
      // Do not leave an orphaned object behind if the row could not be written.
      await this.storage.deleteObjectQuietly(key);
      throw error;
    }
  }

  async findOne(id: string, viewerId?: string): Promise<PostSummary> {
    const post = await this.findLiveOrFail(id);
    const liked = await this.likedIds([post.id], viewerId);
    return toPostSummary(post, liked.has(post.id));
  }

  /**
   * The personalised feed: posts by the authors the caller follows, newest
   * first, keyset-paginated so pages never overlap or skip.
   */
  async feed(viewerId: string, cursor?: string, limit = FEED_PAGE_SIZE): Promise<Page<PostSummary>> {
    const follows = await this.prisma.follow.findMany({
      where: { followerId: viewerId },
      select: { followeeId: true },
    });
    const followeeIds = follows.map((follow) => follow.followeeId);

    if (followeeIds.length === 0) {
      return { items: [], nextCursor: null };
    }

    const rows = await this.prisma.post.findMany({
      where: { removedAt: null, authorId: { in: followeeIds }, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const page = toPage(rows, limit, (row) => row);
    return { items: await this.decorate(page.items, viewerId), nextCursor: page.nextCursor };
  }

  /** The public grid: every member's live posts, newest first. */
  async explore(
    cursor?: string,
    limit = EXPLORE_PAGE_SIZE,
    viewerId?: string,
  ): Promise<Page<PostSummary>> {
    const rows = await this.prisma.post.findMany({
      where: { removedAt: null, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const page = toPage(rows, limit, (row) => row);
    return { items: await this.decorate(page.items, viewerId), nextCursor: page.nextCursor };
  }

  /** A single member's grid, used by the profile page. */
  async byAuthor(
    handle: string,
    cursor?: string,
    limit = EXPLORE_PAGE_SIZE,
    viewerId?: string,
  ): Promise<Page<PostSummary>> {
    const author = await this.users.findByHandleOrFail(handle);

    const rows = await this.prisma.post.findMany({
      where: { removedAt: null, authorId: author.id, ...cursorWhere(cursor) },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit + 1,
      include: POST_INCLUDE,
    });

    const page = toPage(rows, limit, (row) => row);
    return { items: await this.decorate(page.items, viewerId), nextCursor: page.nextCursor };
  }

  /**
   * Edit a caption. Authorship is checked against the token subject; a
   * moderator gets 403 here too, because removal is the moderation route, not
   * silent editing of someone else's words.
   */
  async update(id: string, viewerId: string, dto: UpdatePostDto): Promise<PostSummary> {
    const post = await this.findLiveOrFail(id);
    if (post.authorId !== viewerId) {
      throw new ForbiddenException('You can only edit your own posts');
    }

    if (dto.caption === undefined) {
      // No-op save. The like state still has to be looked up: returning `false`
      // here made the client's view model drop the caller's own like on edit.
      const unchanged = await this.likedIds([id], viewerId);
      return toPostSummary(post, unchanged.has(id));
    }

    const updated = await this.prisma.post.update({
      where: { id },
      data: { caption: dto.caption.length > 0 ? dto.caption : null },
      include: POST_INCLUDE,
    });
    const liked = await this.likedIds([id], viewerId);
    return toPostSummary(updated, liked.has(id));
  }

  /**
   * Author hard-delete. Likes, comments and reports go with it through the
   * schema's cascades, and the stored image is removed afterwards so no orphan
   * object is left in the bucket.
   */
  async remove(id: string, viewerId: string): Promise<{ deleted: true; id: string }> {
    const post = await this.findLiveOrFail(id);
    if (post.authorId !== viewerId) {
      throw new ForbiddenException('You can only delete your own posts');
    }

    // Object first, then the row. The row is the only record of the key, so
    // dropping it first and then failing to delete the object would strand that
    // object in the bucket with nothing left to reclaim it by.
    await this.storage.deleteObjectQuietly(post.imageKey);
    await this.prisma.post.delete({ where: { id } });

    return { deleted: true, id };
  }

  /**
   * Toggle the caller's like.
   *
   * The row write and the counter update share one transaction, and the counter
   * is set to the freshly-counted total rather than incremented blindly, so
   * `likeCount` always equals COUNT(*) of the post's likes and can never drift
   * negative under concurrency.
   */
  async toggleLike(id: string, viewerId: string): Promise<LikeResult> {
    await this.findLiveOrFail(id);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { postId_userId: { postId: id, userId: viewerId } },
      });

      if (existing) {
        // deleteMany, not delete: a concurrent unlike that already removed the
        // row would make `delete` throw P2025 instead of being a no-op.
        await tx.like.deleteMany({ where: { postId: id, userId: viewerId } });
      } else {
        // upsert, not create: two in-flight likes from the same user both read
        // `existing === null`, and the loser of that race violated the composite
        // primary key and surfaced as a 500.
        await tx.like.upsert({
          where: { postId_userId: { postId: id, userId: viewerId } },
          update: {},
          create: { postId: id, userId: viewerId },
        });
      }

      const likeCount = await tx.like.count({ where: { postId: id } });
      await tx.post.update({ where: { id }, data: { likeCount } });

      return { liked: !existing, likeCount };
    });
  }
}
