import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Global exception filter. In production, responses never include stack traces
 * (required for App Store review and security).
 */
@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const res = ctx.getResponse<Response>();
    const req = ctx.getRequest<Request>();

    const isProduction = process.env.NODE_ENV === 'production';
    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    if (exception instanceof HttpException) {
      const resp = exception.getResponse();
      message = typeof resp === 'string' ? resp : (resp as { message?: string | string[] })?.message ?? exception.message;
    }
    const safeMessage =
      isProduction && status === 500
        ? 'Internal server error'
        : Array.isArray(message)
          ? message[0]
          : message;

    if (status >= 500) {
      this.logger.error(
        `${req.method} ${req.url} ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: Record<string, unknown> = {
      statusCode: status,
      message: safeMessage,
    };
    if (!isProduction && exception instanceof Error && exception.stack) {
      body.stack = exception.stack;
    }

    res.status(status).json(body);
  }
}
