import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { OptionalJwtGuard } from '../auth/optional-jwt.guard';
import { CursorQueryDto } from '../common/dto/cursor-query.dto';
import { MAX_IMAGE_BYTES } from '../common/image-validation';
import { Page } from '../common/pagination';
import { PostSummary } from '../common/wire';
import { CreatePostDto } from './dto/create-post.dto';
import { UpdatePostDto } from './dto/update-post.dto';
import { EXPLORE_PAGE_SIZE, FEED_PAGE_SIZE, LikeResult, PostsService } from './posts.service';

@ApiTags('posts')
@Controller('posts')
export class PostsController {
  constructor(private readonly posts: PostsService) {}

  @Post()
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('image', {
      // Buffer in memory: the file is validated by its magic bytes and handed
      // straight to object storage, so it never touches the container disk.
      storage: memoryStorage(),
      limits: { fileSize: MAX_IMAGE_BYTES },
    }),
  )
  create(
    @CurrentUser() user: AuthUser,
    @Body() dto: CreatePostDto,
    @UploadedFile() file?: Express.Multer.File,
  ): Promise<PostSummary> {
    return this.posts.create(user.id, dto, file);
  }

  // Literal segments declared before ':id' so they are never read as post ids.
  @Get('feed')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  feed(@CurrentUser() user: AuthUser, @Query() query: CursorQueryDto): Promise<Page<PostSummary>> {
    return this.posts.feed(user.id, query.cursor, query.limit ?? FEED_PAGE_SIZE);
  }

  @Get('explore')
  @UseGuards(OptionalJwtGuard)
  explore(
    @Query() query: CursorQueryDto,
    @CurrentUser() viewer?: AuthUser,
  ): Promise<Page<PostSummary>> {
    return this.posts.explore(query.cursor, query.limit ?? EXPLORE_PAGE_SIZE, viewer?.id);
  }

  @Get('by/:handle')
  @UseGuards(OptionalJwtGuard)
  byAuthor(
    @Param('handle') handle: string,
    @Query() query: CursorQueryDto,
    @CurrentUser() viewer?: AuthUser,
  ): Promise<Page<PostSummary>> {
    return this.posts.byAuthor(handle, query.cursor, query.limit ?? EXPLORE_PAGE_SIZE, viewer?.id);
  }

  @Get(':id')
  @UseGuards(OptionalJwtGuard)
  findOne(@Param('id') id: string, @CurrentUser() viewer?: AuthUser): Promise<PostSummary> {
    return this.posts.findOne(id, viewer?.id);
  }

  @Patch(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  update(
    @Param('id') id: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: UpdatePostDto,
  ): Promise<PostSummary> {
    return this.posts.update(id, user.id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.posts.remove(id, user.id);
  }

  @Post(':id/like')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  toggleLike(@Param('id') id: string, @CurrentUser() user: AuthUser): Promise<LikeResult> {
    return this.posts.toggleLike(id, user.id);
  }
}
