import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
  Logger,
  PayloadTooLargeException,
} from '@nestjs/common';
import type { Response } from 'express';
import { MulterError } from 'multer';
import { MAX_IMAGE_MESSAGE } from './image-validation';

/**
 * Turns multer's file-size rejection into a 400 validation response.
 *
 * Left alone, an oversized upload surfaces as multer's LIMIT_FILE_SIZE, which
 * @nestjs/platform-express re-throws as a 413 PayloadTooLargeException. The API
 * contract is a 400 with `{message:'Image exceeds 5 MB'}`, so both shapes are
 * caught and normalised here.
 */
@Catch(MulterError, PayloadTooLargeException)
export class UploadExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(UploadExceptionFilter.name);

  catch(exception: MulterError | PayloadTooLargeException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();

    let message = MAX_IMAGE_MESSAGE;
    if (exception instanceof MulterError && exception.code !== 'LIMIT_FILE_SIZE') {
      message =
        exception.code === 'LIMIT_UNEXPECTED_FILE'
          ? `Unexpected file field "${exception.field ?? ''}"`.trim()
          : exception.message;
      this.logger.warn(`Upload rejected (${exception.code}): ${exception.message}`);
    }

    response.status(HttpStatus.BAD_REQUEST).json({
      statusCode: HttpStatus.BAD_REQUEST,
      message,
      error: 'Bad Request',
    });
  }
}
