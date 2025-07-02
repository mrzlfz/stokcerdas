import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AppService {
  constructor(private readonly configService: ConfigService) {}

  getHealthCheck(): object {
    return {
      status: 'OK',
      message: 'StokCerdas API is running',
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    };
  }

  getDetailedHealth(): object {
    const environment = this.configService.get('NODE_ENV', 'development');
    const port = this.configService.get('PORT', 3000);

    return {
      status: 'OK',
      service: 'StokCerdas API',
      version: '1.0.0',
      environment,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      config: {
        port,
        nodeVersion: process.version,
        platform: process.platform,
      },
      features: {
        multiTenant: true,
        realTime: true,
        ai: true,
        mobile: true,
      },
    };
  }
}