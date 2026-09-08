import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UsersService } from '../users/users.service';

export interface FollowResult {
  following: boolean;
  followerCount: number;
}

@Injectable()
export class FollowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly users: UsersService,
  ) {}

  private async resolveTarget(handle: string, viewerId: string): Promise<string> {
    const target = await this.users.findByHandleOrFail(handle);
    if (target.id === viewerId) {
      throw new BadRequestException('Cannot follow self');
    }
    return target.id;
  }

  /**
   * Follow a member. `upsert` on the composite key makes a repeated call a
   * no-op rather than a unique-constraint 500, so the button is safe to
   * double-click.
   */
  async follow(handle: string, viewerId: string): Promise<FollowResult> {
    const followeeId = await this.resolveTarget(handle, viewerId);

    await this.prisma.follow.upsert({
      where: { followerId_followeeId: { followerId: viewerId, followeeId } },
      update: {},
      create: { followerId: viewerId, followeeId },
    });

    return {
      following: true,
      followerCount: await this.prisma.follow.count({ where: { followeeId } }),
    };
  }

  /** Unfollow. `deleteMany` no-ops when the row is already gone. */
  async unfollow(handle: string, viewerId: string): Promise<FollowResult> {
    const followeeId = await this.resolveTarget(handle, viewerId);

    await this.prisma.follow.deleteMany({ where: { followerId: viewerId, followeeId } });

    return {
      following: false,
      followerCount: await this.prisma.follow.count({ where: { followeeId } }),
    };
  }
}
