import {
  HttpException,
  HttpStatus,
  Logger,
  BadRequestException,
  InternalServerErrorException,
} from '@nestjs/common';

/**
 * Base controller for analytics with consistent Indonesian error handling
 */
export abstract class BaseAnalyticsController {
  protected readonly logger = new Logger(this.constructor.name);

  /**
   * Handle service errors with Indonesian localization
   */
  protected handleServiceError(error: any, context: string): never {
    this.logger.error(`${context} failed: ${error.message}`, error.stack);

    // If service already returned Indonesian error message, use it
    if (error.message && this.isIndonesianMessage(error.message)) {
      throw new HttpException(
        {
          success: false,
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        this.getHttpStatusFromError(error),
      );
    }

    // Translate common error messages to Indonesian
    const indonesianError = this.translateErrorToIndonesian(
      error.message || 'Unknown error',
    );

    throw new HttpException(
      {
        success: false,
        error: indonesianError,
        timestamp: new Date().toISOString(),
        context,
      },
      this.getHttpStatusFromError(error),
    );
  }

  /**
   * Handle validation errors with Indonesian messages
   */
  protected handleValidationError(message: string): never {
    throw new BadRequestException({
      success: false,
      error: this.translateValidationToIndonesian(message),
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Create standardized success response
   */
  protected createSuccessResponse<T>(
    data: T,
    meta?: any,
    message?: string,
  ): {
    success: boolean;
    data: T;
    meta?: any;
    message?: string;
    timestamp: string;
  } {
    return {
      success: true,
      data,
      ...(meta && { meta }),
      ...(message && { message }),
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Check if message is already in Indonesian
   */
  private isIndonesianMessage(message: string): boolean {
    const indonesianKeywords = [
      'tidak',
      'dapat',
      'gagal',
      'berhasil',
      'data',
      'sistem',
      'prediksi',
      'model',
      'analisis',
      'produk',
      'stok',
      'inventori',
      'untuk',
      'dengan',
      'atau',
      'dan',
      'yang',
      'dalam',
      'pada',
      'dari',
      'ke',
      'akan',
      'sudah',
      'belum',
      'harus',
      'perlu',
      'bisa',
      'tidak bisa',
      'ditemukan',
      'tersedia',
    ];

    return indonesianKeywords.some(keyword =>
      message.toLowerCase().includes(keyword),
    );
  }

  /**
   * Translate common error messages to Indonesian
   */
  private translateErrorToIndonesian(errorMessage: string): string {
    const errorMappings: Record<string, string> = {
      // Database errors
      'Database connection error': 'Koneksi database bermasalah',
      'Connection timeout': 'Koneksi database timeout',
      'Query failed': 'Query database gagal',
      'Transaction failed': 'Transaksi database gagal',

      // Authentication errors
      Unauthorized: 'Tidak memiliki akses',
      Forbidden: 'Akses ditolak',
      'Token expired': 'Token akses sudah kedaluwarsa',
      'Invalid token': 'Token akses tidak valid',

      // Validation errors
      'Validation failed': 'Validasi data gagal',
      'Invalid input': 'Input data tidak valid',
      'Missing required field': 'Field wajib tidak diisi',
      'Invalid format': 'Format data tidak valid',

      // Business logic errors
      'Product not found': 'Produk tidak ditemukan',
      'Insufficient data': 'Data tidak mencukupi untuk analisis',
      'No data available': 'Data tidak tersedia',
      'Analysis failed': 'Analisis gagal dilakukan',
      'Prediction failed': 'Prediksi gagal dibuat',
      'Model not available': 'Model prediksi tidak tersedia',

      // System errors
      'Internal server error': 'Terjadi kesalahan sistem internal',
      'Service unavailable': 'Layanan sedang tidak tersedia',
      'Timeout error': 'Sistem mengalami timeout',
      'Unknown error': 'Terjadi kesalahan yang tidak dikenal',
    };

    // Check for exact matches first
    if (errorMappings[errorMessage]) {
      return errorMappings[errorMessage];
    }

    // Check for partial matches
    for (const [englishPattern, indonesianMessage] of Object.entries(
      errorMappings,
    )) {
      if (errorMessage.toLowerCase().includes(englishPattern.toLowerCase())) {
        return indonesianMessage;
      }
    }

    // Fallback to generic Indonesian error message
    return `Terjadi kesalahan dalam sistem: ${errorMessage}`;
  }

  /**
   * Translate validation errors to Indonesian
   */
  private translateValidationToIndonesian(message: string): string {
    const validationMappings: Record<string, string> = {
      'Product IDs are required': 'ID produk wajib diisi',
      'Invalid product ID': 'ID produk tidak valid',
      'Invalid date format': 'Format tanggal tidak valid',
      'Date range is invalid': 'Rentang tanggal tidak valid',
      'Maximum 50 products allowed': 'Maksimal 50 produk diperbolehkan',
      'Invalid analysis type': 'Jenis analisis tidak valid',
      'Invalid time horizon': 'Horizon waktu tidak valid',
      'Invalid forecast days': 'Jumlah hari prediksi tidak valid',
      'Page number must be positive': 'Nomor halaman harus positif',
      'Limit must be between 1 and 100': 'Limit harus antara 1 dan 100',
      'Product ID is required': 'ID produk wajib diisi',
      'Prediction type is required': 'Jenis prediksi wajib dipilih',
    };

    // Check for exact matches
    if (validationMappings[message]) {
      return validationMappings[message];
    }

    // Check for partial matches
    for (const [englishPattern, indonesianMessage] of Object.entries(
      validationMappings,
    )) {
      if (message.toLowerCase().includes(englishPattern.toLowerCase())) {
        return indonesianMessage;
      }
    }

    return `Data input tidak valid: ${message}`;
  }

  /**
   * Get appropriate HTTP status from error
   */
  private getHttpStatusFromError(error: any): HttpStatus {
    if (error instanceof BadRequestException) {
      return HttpStatus.BAD_REQUEST;
    }

    if (error.message) {
      const message = error.message.toLowerCase();

      if (
        message.includes('not found') ||
        message.includes('tidak ditemukan')
      ) {
        return HttpStatus.NOT_FOUND;
      }

      if (
        message.includes('unauthorized') ||
        message.includes('tidak memiliki akses')
      ) {
        return HttpStatus.UNAUTHORIZED;
      }

      if (message.includes('forbidden') || message.includes('akses ditolak')) {
        return HttpStatus.FORBIDDEN;
      }

      if (
        message.includes('validation') ||
        message.includes('invalid') ||
        message.includes('validasi') ||
        message.includes('tidak valid')
      ) {
        return HttpStatus.BAD_REQUEST;
      }
    }

    return HttpStatus.INTERNAL_SERVER_ERROR;
  }

  /**
   * Log analytics operation for monitoring
   */
  protected logAnalyticsOperation(
    tenantId: string,
    operation: string,
    duration?: number,
    additionalData?: any,
  ): void {
    this.logger.log(
      `Analytics Operation: ${operation} | Tenant: ${tenantId} | Duration: ${duration}ms`,
      additionalData ? JSON.stringify(additionalData) : undefined,
    );
  }

  /**
   * Create standardized meta object
   */
  protected createMetaObject(
    total?: number,
    page?: number,
    limit?: number,
    executionTime?: number,
  ): any {
    const meta: any = {
      generatedAt: new Date().toISOString(),
    };

    if (total !== undefined) meta.total = total;
    if (page !== undefined) meta.page = page;
    if (limit !== undefined) meta.limit = limit;
    if (executionTime !== undefined) meta.executionTime = executionTime;
    if (total !== undefined && limit !== undefined) {
      meta.totalPages = Math.ceil(total / limit);
    }

    return meta;
  }
}
