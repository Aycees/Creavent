import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  Logger,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { ErrorResponse } from '@creavent/shared';
import { Prisma } from './generated/prisma/client.js';
import { STATUS_CODES } from 'node:http';

// Turns every error into the one error shape (docs/architecture.md §3.4).
// Anything that is not an HttpException is logged and answered with a
// generic 500, so internal messages and stack traces never reach the client.
@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  constructor(private readonly adapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const body = this.toBody(exception);
    if (body.statusCode >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.message : String(exception),
        exception instanceof Error ? exception.stack : undefined,
      );
    }
    const response = host.switchToHttp().getResponse();
    this.adapterHost.httpAdapter.reply(response, body, body.statusCode);
  }

  private toBody(exception: unknown): ErrorResponse {
    // A unique rule in the database caught two saves at the same moment (a
    // slot label, a page link). The app checks first, so this is a race: ask
    // the user to try again rather than answer 500.
    if (exception instanceof Prisma.PrismaClientKnownRequestError && exception.code === 'P2002') {
      return { statusCode: 409, error: 'Conflict', message: 'Someone just saved the same thing. Try again.' };
    }
    if (!(exception instanceof HttpException)) {
      return {
        statusCode: 500,
        error: 'Internal Server Error',
        message: 'Internal server error',
      };
    }
    const statusCode = exception.getStatus();
    const res = exception.getResponse();
    const details =
      typeof res === 'object' && 'details' in res
        ? (res.details as ErrorResponse['details'])
        : undefined;
    return {
      statusCode,
      error: STATUS_CODES[statusCode] ?? 'Error',
      message: exception.message,
      ...(details && { details }),
    };
  }
}
