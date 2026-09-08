import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CursorQueryDto } from '../common/dto/cursor-query.dto';
import { Page } from '../common/pagination';
import { PostComment } from '../common/wire';
import { COMMENT_PAGE_SIZE, CommentsService } from './comments.service';
import { CreateCommentDto } from './dto/create-comment.dto';

@ApiTags('comments')
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}

  @Get('posts/:id/comments')
  list(@Param('id') postId: string, @Query() query: CursorQueryDto): Promise<Page<PostComment>> {
    return this.comments.list(postId, query.cursor, query.limit ?? COMMENT_PAGE_SIZE);
  }

  @Post('posts/:id/comments')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  create(
    @Param('id') postId: string,
    @CurrentUser() user: AuthUser,
    @Body() dto: CreateCommentDto,
  ): Promise<PostComment> {
    return this.comments.create(postId, user.id, dto);
  }

  @Delete('comments/:id')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.comments.remove(id, user);
  }
}
