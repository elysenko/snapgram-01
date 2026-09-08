import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import { MAX_IMAGE_BYTES } from '../common/image-validation';
import { SessionUser, UserSummary } from '../common/wire';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { PublicProfile, UsersService } from './users.service';

@ApiTags('users')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  // Declared before ':handle' so the literal segment "me" is never parsed as a
  // profile slug.
  @Patch('me')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  updateMe(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<SessionUser> {
    return this.usersService.updateMe(user.id, dto);
  }

  @Put('me/avatar')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('avatar', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  updateAvatar(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<SessionUser> {
    return this.usersService.setAvatar(user.id, file);
  }

  @Get(':handle')
  @UseGuards(OptionalJwtGuard)
  getProfile(
    @Param('handle') handle: string,
    @CurrentUser() viewer?: AuthUser,
  ): Promise<PublicProfile> {
    return this.usersService.getProfile(handle, viewer?.id);
  }

  @Get(':handle/followers')
  @UseGuards(OptionalJwtGuard)
  followers(@Param('handle') handle: string): Promise<UserSummary[]> {
    return this.usersService.listFollowers(handle);
  }

  @Get(':handle/following')
  @UseGuards(OptionalJwtGuard)
  following(@Param('handle') handle: string): Promise<UserSummary[]> {
    return this.usersService.listFollowing(handle);
  }
}
