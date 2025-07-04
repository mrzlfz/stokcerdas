import { registerAs } from '@nestjs/config';

export const storageConfig = registerAs('storage', () => ({
  // MinIO/S3 Configuration
  endpoint: process.env.MINIO_ENDPOINT || 'http://localhost:9000',
  accessKey: process.env.MINIO_ACCESS_KEY || 'minioadmin',
  secretKey: process.env.MINIO_SECRET_KEY || 'minioadmin123',
  region: process.env.MINIO_REGION || 'us-east-1',

  // Buckets
  buckets: {
    uploads: process.env.MINIO_BUCKET_UPLOADS || 'stokcerdas-uploads',
    exports: process.env.MINIO_BUCKET_EXPORTS || 'stokcerdas-exports',
    backups: process.env.MINIO_BUCKET_BACKUPS || 'stokcerdas-backups',
  },

  // File limits
  maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10) || 10485760, // 10MB
  allowedMimeTypes: process.env.ALLOWED_MIME_TYPES?.split(',') || [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'application/pdf',
    'text/csv',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ],

  // CDN
  cdnUrl: process.env.CDN_URL || process.env.MINIO_ENDPOINT,
  useSSL: process.env.MINIO_USE_SSL === 'true' || false,
}));
