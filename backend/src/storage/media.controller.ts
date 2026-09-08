import { BadRequestException, Controller, Get, NotFoundException, Param, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { contentTypeForKey } from '../common/image-validation';
import { ObjectNotFoundError, StorageService } from './storage.service';

/**
 * Public read proxy for stored images.
 *
 * Explore and profile pages are viewable logged out, so this route carries no
 * guard. Objects are addressed by an unguessable key and served with an
 * immutable cache header, since a key's bytes never change.
 */
@ApiTags('media')
@Controller('media')
export class MediaController {
  constructor(private readonly storage: StorageService) {}

  // Express 5 wildcard: `*key` captures the remaining path segments, which is
  // what lets a multi-segment key like `posts/<uuid>.png` resolve here.
  @Get('*key')
  async get(@Param('key') key: string | string[], @Res() res: Response): Promise<void> {
    const objectKey = Array.isArray(key) ? key.join('/') : key;

    // Reject traversal before it reaches the storage client.
    if (!objectKey || objectKey.includes('..') || objectKey.startsWith('/')) {
      throw new BadRequestException('Invalid media key');
    }

    let object;
    try {
      object = await this.storage.getObject(objectKey);
    } catch (error) {
      if (error instanceof ObjectNotFoundError) {
        throw new NotFoundException('Media not found');
      }
      throw error;
    }

    const contentType =
      object.contentType && object.contentType !== 'application/octet-stream'
        ? object.contentType
        : contentTypeForKey(objectKey);

    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    if (object.contentLength !== undefined) {
      res.setHeader('Content-Length', object.contentLength);
    }

    object.body.on('error', () => {
      if (!res.headersSent) {
        res.status(404).end();
      } else {
        res.end();
      }
    });
    object.body.pipe(res);
  }
}
