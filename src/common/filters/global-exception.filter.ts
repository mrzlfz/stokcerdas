import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { QueryFailedError } from 'typeorm';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code = 'INTERNAL_ERROR';
    let details: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      
      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object') {
        message = (exceptionResponse as any).message || exception.message;
        code = (exceptionResponse as any).code || exception.name;
        details = (exceptionResponse as any).details;
      }
    } else if (exception instanceof QueryFailedError) {
      status = HttpStatus.BAD_REQUEST;
      message = 'Database query failed';
      code = 'DATABASE_ERROR';
      
      // Handle specific database errors
      if (exception.message.includes('duplicate key')) {
        message = 'Resource already exists';
        code = 'DUPLICATE_RESOURCE';
        status = HttpStatus.CONFLICT;
      } else if (exception.message.includes('foreign key')) {
        message = 'Invalid reference to related resource';
        code = 'INVALID_REFERENCE';
      }
    } else if (exception instanceof Error) {
      message = exception.message;
      code = exception.name;
    }

    const errorResponse = {
      success: false,
      error: {
        code,
        message,
        details,
        timestamp: new Date().toISOString(),
        path: request.url,
        method: request.method,
        ...(process.env.NODE_ENV === 'development' && {
          stack: exception instanceof Error ? exception.stack : undefined,
        }),
      },
      meta: {
        requestId: request.headers['x-request-id'] || 'unknown',
        tenantId: request.headers['x-tenant-id'] || null,
        userId: (request as any).user?.id || null,
      },
    };

    // Log the error
    this.logger.error(
      `${request.method} ${request.url} - ${status} - ${message}`,
      {
        exception: exception instanceof Error ? exception.stack : exception,
        request: {
          headers: request.headers,
          query: request.query,
          params: request.params,
          body: request.body,
        },
        user: (request as any).user,
      },
    );

    response.status(status).json(errorResponse);
  }
}