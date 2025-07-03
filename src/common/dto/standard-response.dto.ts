import { ApiProperty } from '@nestjs/swagger';

export interface StandardResponseMeta {
  page?: number;
  limit?: number;
  total?: number;
  totalPages?: number;
  hasNextPage?: boolean;
  hasPrevPage?: boolean;
  timestamp?: string;
  requestId?: string;
  [key: string]: any;
}

export class StandardResponse<T = any> {
  @ApiProperty({ 
    description: 'Indicates if the request was successful',
    example: true
  })
  success: boolean;

  @ApiProperty({ 
    description: 'HTTP status code',
    example: 200,
    required: false
  })
  statusCode?: number;

  @ApiProperty({ 
    description: 'Response message (in Indonesian)',
    example: 'Data berhasil diambil'
  })
  message: string;

  @ApiProperty({ 
    description: 'Response data',
    required: false
  })
  data?: T;

  @ApiProperty({ 
    description: 'Additional metadata',
    required: false
  })
  meta?: StandardResponseMeta;

  @ApiProperty({ 
    description: 'Error details (only present when success is false)',
    required: false
  })
  error?: {
    code?: string;
    details?: string;
    validationErrors?: Array<{
      field: string;
      message: string;
      value?: any;
    }>;
    stack?: string; // Only in development
  };

  constructor(data?: Partial<StandardResponse<T>>) {
    this.success = data?.success ?? true;
    this.statusCode = data?.statusCode ?? 200;
    this.message = data?.message ?? 'Operasi berhasil';
    this.data = data?.data;
    this.meta = data?.meta;
    this.error = data?.error;
  }

  // Static factory methods for common responses
  static success<T>(
    data?: T, 
    message: string = 'Operasi berhasil', 
    meta?: StandardResponseMeta,
    statusCode: number = 200
  ): StandardResponse<T> {
    return new StandardResponse<T>({
      success: true,
      statusCode,
      message,
      data,
      meta: {
        ...meta,
        timestamp: new Date().toISOString()
      }
    });
  }

  static created<T>(
    data?: T, 
    message: string = 'Data berhasil dibuat'
  ): StandardResponse<T> {
    return StandardResponse.success(data, message, undefined, 201);
  }

  static updated<T>(
    data?: T, 
    message: string = 'Data berhasil diperbarui'
  ): StandardResponse<T> {
    return StandardResponse.success(data, message, undefined, 200);
  }

  static deleted(message: string = 'Data berhasil dihapus'): StandardResponse<null> {
    return StandardResponse.success(null, message, undefined, 200);
  }

  static error(
    message: string = 'Terjadi kesalahan',
    statusCode: number = 500,
    code?: string,
    details?: string,
    validationErrors?: Array<{ field: string; message: string; value?: any }>
  ): StandardResponse<null> {
    return new StandardResponse<null>({
      success: false,
      statusCode,
      message,
      data: null,
      error: {
        code,
        details,
        validationErrors
      },
      meta: {
        timestamp: new Date().toISOString()
      }
    });
  }

  static badRequest(
    message: string = 'Permintaan tidak valid',
    validationErrors?: Array<{ field: string; message: string; value?: any }>
  ): StandardResponse<null> {
    return StandardResponse.error(message, 400, 'BAD_REQUEST', undefined, validationErrors);
  }

  static unauthorized(
    message: string = 'Akses tidak diizinkan'
  ): StandardResponse<null> {
    return StandardResponse.error(message, 401, 'UNAUTHORIZED');
  }

  static forbidden(
    message: string = 'Akses dilarang'
  ): StandardResponse<null> {
    return StandardResponse.error(message, 403, 'FORBIDDEN');
  }

  static notFound(
    message: string = 'Data tidak ditemukan'
  ): StandardResponse<null> {
    return StandardResponse.error(message, 404, 'NOT_FOUND');
  }

  static conflict(
    message: string = 'Data sudah ada'
  ): StandardResponse<null> {
    return StandardResponse.error(message, 409, 'CONFLICT');
  }

  static internalError(
    message: string = 'Kesalahan server internal'
  ): StandardResponse<null> {
    return StandardResponse.error(message, 500, 'INTERNAL_ERROR');
  }

  // Pagination helper
  static paginated<T>(
    data: T[],
    page: number,
    limit: number,
    total: number,
    message: string = 'Data berhasil diambil'
  ): StandardResponse<T[]> {
    const totalPages = Math.ceil(total / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;

    return StandardResponse.success(
      data,
      message,
      {
        page,
        limit,
        total,
        totalPages,
        hasNextPage,
        hasPrevPage,
        timestamp: new Date().toISOString()
      }
    );
  }
}

// Type aliases for common use cases
export type ApiResponse<T = any> = StandardResponse<T>;
export type ApiSuccessResponse<T = any> = StandardResponse<T>;
export type ApiErrorResponse = StandardResponse<null>;

// Response DTOs for Swagger documentation
export class ApiResponseDto<T = any> extends StandardResponse<T> {}
export class ApiSuccessResponseDto<T = any> extends StandardResponse<T> {}
export class ApiErrorResponseDto extends StandardResponse<null> {}