import { ArgumentsHost, Catch, ExceptionFilter, HttpStatus, Logger } from '@nestjs/common';
import type { Response } from 'express';
import { ServiceUnconfiguredError } from '../lib/config';

/**
 * Maps a missing third-party credential to 503 Service Unavailable.
 *
 * A feature whose integration is unconfigured degrades to a clear, actionable
 * error on that route only; it must never take down routes that do not use it.
 */
@Catch(ServiceUnconfiguredError)
export class ServiceUnconfiguredFilter implements ExceptionFilter {
  private readonly logger = new Logger(ServiceUnconfiguredFilter.name);

  catch(exception: ServiceUnconfiguredError, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    this.logger.warn(exception.message);

    response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
      statusCode: HttpStatus.SERVICE_UNAVAILABLE,
      message: exception.message,
      error: 'Service Unavailable',
      service: exception.service,
      missingKeys: exception.missingKeys,
    });
  }
}
