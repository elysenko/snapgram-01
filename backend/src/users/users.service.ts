import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { validateImageUpload } from '../common/image-validation';
import {
  SessionUser,
  USER_SELECT,
  UserSummary,
  toSessionUser,
  toUserSummary,
} from '../common/wire';
import { UpdateProfileDto } from './dto/update-profile.dto';

export interface PublicProfile extends UserSummary {
  bio: string | null;
  createdAt: string;
  postCount: number;
  followerCount: number;
  followingCount: number;
  viewerFollows: boolean;
  isSelf: boolean;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  /** Resolve a profile slug, falling back to the id for accounts without one. */
  async findByHandleOrFail(handle: string) {
    const user = await this.prisma.user.findFirst({
      where: { OR: [{ handle }, { id: handle }] },
      select: USER_SELECT,
    });
    if (!user) {
      throw new NotFoundException('No such profile');
    }
    return user;
  }

  /**
   * Public profile with its three counts.
   *
   * `postCount` counts only live posts — a moderator-removed post disappears
   * from the count as well as from the grid.
   */
  async getProfile(handle: string, viewerId?: string): Promise<PublicProfile> {
    const user = await this.findByHandleOrFail(handle);

    const [postCount, followerCount, followingCount, follow] = await Promise.all([
      this.prisma.post.count({ where: { authorId: user.id, removedAt: null } }),
      this.prisma.follow.count({ where: { followeeId: user.id } }),
      this.prisma.follow.count({ where: { followerId: user.id } }),
      viewerId && viewerId !== user.id
        ? this.prisma.follow.findUnique({
            where: { followerId_followeeId: { followerId: viewerId, followeeId: user.id } },
            select: { followerId: true },
          })
        : Promise.resolve(null),
    ]);

    return {
      ...toUserSummary(user),
      bio: user.bio,
      createdAt: user.createdAt.toISOString(),
      postCount,
      followerCount,
      followingCount,
      viewerFollows: follow !== null,
      isSelf: viewerId === user.id,
    };
  }

  /** List the accounts following this profile (the `?tab=followers` pane). */
  async listFollowers(handle: string): Promise<UserSummary[]> {
    const user = await this.findByHandleOrFail(handle);
    const rows = await this.prisma.follow.findMany({
      where: { followeeId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { follower: { select: USER_SELECT } },
    });
    return rows.map((row) => toUserSummary(row.follower));
  }

  /** List the accounts this profile follows (the `?tab=following` pane). */
  async listFollowing(handle: string): Promise<UserSummary[]> {
    const user = await this.findByHandleOrFail(handle);
    const rows = await this.prisma.follow.findMany({
      where: { followerId: user.id },
      orderBy: { createdAt: 'desc' },
      select: { followee: { select: USER_SELECT } },
    });
    return rows.map((row) => toUserSummary(row.followee));
  }

  /**
   * Update the caller's own profile.
   *
   * Scoped by `where: { id: userId }` taken from the verified token — never
   * from the request body — which is what guarantees one member's edit cannot
   * touch another member's row.
   */
  async updateMe(userId: string, dto: UpdateProfileDto): Promise<SessionUser> {
    const data: { displayName?: string; name?: string; bio?: string } = {};
    if (dto.displayName !== undefined) {
      data.displayName = dto.displayName;
      // Keep the platform's `name` column in step with the public display name.
      data.name = dto.displayName;
    }
    if (dto.bio !== undefined) {
      data.bio = dto.bio;
    }

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: USER_SELECT,
    });
    return toSessionUser(user);
  }

  /**
   * Replace the caller's avatar.
   *
   * The image is validated before anything is written, so a rejected upload
   * leaves both the bucket and `avatarUrl` untouched.
   */
  async setAvatar(userId: string, file?: Express.Multer.File): Promise<SessionUser> {
    const { mime, ext } = validateImageUpload(file);

    const key = this.storage.avatarKey(userId, ext);
    await this.storage.putObject(key, file!.buffer, mime);

    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: this.storage.publicUrl(key) },
      select: USER_SELECT,
    });
    return toSessionUser(user);
  }

  /** Directory listing. Selects explicitly so `passwordHash` can never leak. */
  async findAll(): Promise<UserSummary[]> {
    const users = await this.prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: USER_SELECT,
    });
    return users.map(toUserSummary);
  }

  async findById(id: string): Promise<UserSummary | null> {
    const user = await this.prisma.user.findUnique({ where: { id }, select: USER_SELECT });
    return user ? toUserSummary(user) : null;
  }
}
