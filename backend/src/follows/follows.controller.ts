import { Controller, Delete, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { FollowResult, FollowsService } from './follows.service';

/**
 * Mounted under the users prefix so the follow edge reads as a sub-resource of
 * the profile it points at. Two-segment paths, so these never shadow
 * `GET /users/:handle` or `PATCH /users/me`.
 */
@ApiTags('follows')
@ApiBearerAuth()
@Controller('users')
@UseGuards(JwtAuthGuard)
export class FollowsController {
  constructor(private readonly follows: FollowsService) {}

  @Post(':handle/follow')
  @HttpCode(HttpStatus.OK)
  follow(@Param('handle') handle: string, @CurrentUser() user: AuthUser): Promise<FollowResult> {
    return this.follows.follow(handle, user.id);
  }

  @Delete(':handle/follow')
  @HttpCode(HttpStatus.OK)
  unfollow(@Param('handle') handle: string, @CurrentUser() user: AuthUser): Promise<FollowResult> {
    return this.follows.unfollow(handle, user.id);
  }
}
