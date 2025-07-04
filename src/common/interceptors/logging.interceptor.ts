import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    const { method, url, headers, body, query, params } = request;
    const userAgent = headers['user-agent'] || '';
    const ip = headers['x-forwarded-for'] || request.connection.remoteAddress;
    const tenantId = headers['x-tenant-id'];
    const userId = (request as any).user?.id;

    const startTime = Date.now();
    const requestId = headers['x-request-id'] || this.generateRequestId();

    // Set request ID in response headers
    response.setHeader('x-request-id', requestId);

    this.logger.log(`→ ${method} ${url}`, {
      requestId,
      tenantId,
      userId,
      ip,
      userAgent,
      query,
      params,
      body: this.sanitizeBody(body),
    });

    return next.handle().pipe(
      tap(
        data => {
          const duration = Date.now() - startTime;
          this.logger.log(
            `← ${method} ${url} ${response.statusCode} - ${duration}ms`,
            {
              requestId,
              tenantId,
              userId,
              statusCode: response.statusCode,
              duration,
              responseSize: JSON.stringify(data).length,
            },
          );
        },
        error => {
          const duration = Date.now() - startTime;
          this.logger.error(`← ${method} ${url} ERROR - ${duration}ms`, {
            requestId,
            tenantId,
            userId,
            duration,
            error: error.message,
            stack: error.stack,
          });
        },
      ),
    );
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private sanitizeBody(body: any): any {
    if (!body) return body;

    const sanitized = { ...body };
    const sensitiveFields = [
      'password',
      'token',
      'secret',
      'key',
      'authorization',
    ];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}
