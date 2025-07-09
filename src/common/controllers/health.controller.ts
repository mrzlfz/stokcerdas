import { Controller, Get, HttpStatus, Res } from '@nestjs/common';
import { Response } from 'express';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { DependencyHealthService } from '../services/dependency-health.service';

/**
 * HealthController - System Health Monitoring Endpoints
 * 
 * Provides comprehensive health check endpoints for:
 * - Overall system health
 * - Individual service health
 * - Python ML environment status
 * - Database connectivity
 * - Redis performance
 * - Indonesian business context
 * 
 * Optimized for StokCerdas AI production monitoring
 */

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly dependencyHealthService: DependencyHealthService,
  ) {}

  /**
   * Quick health check endpoint
   * Used by Docker, Kubernetes, and load balancers
   */
  @Get()
  @ApiOperation({ 
    summary: 'Quick health check',
    description: 'Lightweight health check for load balancers and container orchestration'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Service is healthy',
    schema: {
      example: {
        status: 'healthy',
        timestamp: '2025-07-09T14:30:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 503, 
    description: 'Service is unhealthy',
    schema: {
      example: {
        status: 'unhealthy',
        timestamp: '2025-07-09T14:30:00.000Z'
      }
    }
  })
  async quickHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.quickHealthCheck();
      
      const statusCode = healthResult.status === 'healthy' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json(healthResult);
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        status: 'unhealthy',
        timestamp: new Date(),
        error: error.message,
      });
    }
  }

  /**
   * Comprehensive health check endpoint
   * Detailed system health with all dependencies
   */
  @Get('detailed')
  @ApiOperation({ 
    summary: 'Comprehensive health check',
    description: 'Detailed health check including all dependencies, Python ML environment, and performance metrics'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Comprehensive health information',
    schema: {
      example: {
        overall: 'healthy',
        services: [
          {
            service: 'database',
            status: 'healthy',
            responseTime: 45,
            details: {
              type: 'postgresql',
              isConnected: true,
              migrations: []
            },
            timestamp: '2025-07-09T14:30:00.000Z'
          }
        ],
        python: {
          environment: 'healthy',
          dependencies: [
            {
              package: 'pandas',
              version: '2.0.3',
              status: 'installed'
            }
          ],
          version: 'Python 3.13.3',
          virtualenv: true
        },
        performance: {
          memoryUsage: {
            rss: 123456789,
            heapTotal: 98765432,
            heapUsed: 87654321
          },
          uptime: 3600,
          loadAverage: [0.5, 0.6, 0.7]
        },
        indonesian: {
          timezone: 'Asia/Jakarta',
          locale: 'id-ID',
          businessHours: true,
          calendar: 'available'
        }
      }
    }
  })
  async detailedHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      
      const statusCode = healthResult.overall === 'healthy' ? HttpStatus.OK : 
                        healthResult.overall === 'degraded' ? HttpStatus.PARTIAL_CONTENT : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json(healthResult);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        overall: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Python ML environment specific health check
   */
  @Get('python')
  @ApiOperation({ 
    summary: 'Python ML environment health',
    description: 'Specific health check for Python ML dependencies and environment'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Python ML environment status',
    schema: {
      example: {
        environment: 'healthy',
        dependencies: [
          {
            package: 'pandas',
            version: '2.0.3',
            status: 'installed'
          },
          {
            package: 'prophet',
            version: '1.1.4',
            status: 'installed'
          },
          {
            package: 'xgboost',
            version: '1.7.6',
            status: 'installed'
          }
        ],
        version: 'Python 3.13.3',
        virtualenv: true,
        indonesian_context: {
          holidays_enabled: true,
          business_calendar: true,
          payday_effects: true,
          ramadan_effects: true
        }
      }
    }
  })
  async pythonHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      
      const statusCode = healthResult.python.environment === 'healthy' ? HttpStatus.OK : 
                        healthResult.python.environment === 'degraded' ? HttpStatus.PARTIAL_CONTENT : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json({
        ...healthResult.python,
        indonesian_context: healthResult.indonesian,
        timestamp: new Date(),
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        environment: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Database health check
   */
  @Get('database')
  @ApiOperation({ 
    summary: 'Database health check',
    description: 'Specific health check for PostgreSQL database connectivity and performance'
  })
  async databaseHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      const dbHealth = healthResult.services.find(s => s.service === 'database');
      
      if (!dbHealth) {
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          service: 'database',
          status: 'unhealthy',
          error: 'Database health check not available',
          timestamp: new Date(),
        });
      }
      
      const statusCode = dbHealth.status === 'healthy' ? HttpStatus.OK : 
                        dbHealth.status === 'degraded' ? HttpStatus.PARTIAL_CONTENT : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json(dbHealth);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        service: 'database',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Redis health check
   */
  @Get('redis')
  @ApiOperation({ 
    summary: 'Redis health check',
    description: 'Specific health check for Redis connectivity and performance'
  })
  async redisHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      const redisHealth = healthResult.services.find(s => s.service === 'redis');
      
      if (!redisHealth) {
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          service: 'redis',
          status: 'unhealthy',
          error: 'Redis health check not available',
          timestamp: new Date(),
        });
      }
      
      const statusCode = redisHealth.status === 'healthy' ? HttpStatus.OK : 
                        redisHealth.status === 'degraded' ? HttpStatus.PARTIAL_CONTENT : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json(redisHealth);
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        service: 'redis',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Indonesian business context health check
   */
  @Get('indonesian-context')
  @ApiOperation({ 
    summary: 'Indonesian business context health',
    description: 'Health check for Indonesian business context services and configuration'
  })
  async indonesianHealth(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      const indonesianHealth = healthResult.services.find(s => s.service === 'indonesian-context');
      
      if (!indonesianHealth) {
        return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
          service: 'indonesian-context',
          status: 'unhealthy',
          error: 'Indonesian context health check not available',
          timestamp: new Date(),
        });
      }
      
      const statusCode = indonesianHealth.status === 'healthy' ? HttpStatus.OK : 
                        indonesianHealth.status === 'degraded' ? HttpStatus.PARTIAL_CONTENT : 
                        HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json({
        ...indonesianHealth,
        business_context: healthResult.indonesian,
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        service: 'indonesian-context',
        status: 'unhealthy',
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Performance metrics endpoint
   */
  @Get('performance')
  @ApiOperation({ 
    summary: 'Performance metrics',
    description: 'System performance metrics including memory usage and uptime'
  })
  @ApiResponse({ 
    status: 200, 
    description: 'Performance metrics',
    schema: {
      example: {
        memoryUsage: {
          rss: 123456789,
          heapTotal: 98765432,
          heapUsed: 87654321,
          external: 12345678
        },
        uptime: 3600,
        loadAverage: [0.5, 0.6, 0.7],
        timestamp: '2025-07-09T14:30:00.000Z'
      }
    }
  })
  async performanceMetrics(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      
      return res.status(HttpStatus.OK).json({
        ...healthResult.performance,
        timestamp: new Date(),
      });
    } catch (error) {
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Readiness probe endpoint
   * For Kubernetes readiness probes
   */
  @Get('ready')
  @ApiOperation({ 
    summary: 'Readiness probe',
    description: 'Kubernetes readiness probe endpoint'
  })
  async readinessProbe(@Res() res: Response) {
    try {
      const healthResult = await this.dependencyHealthService.performHealthCheck();
      
      // Service is ready if overall health is healthy or degraded
      const isReady = healthResult.overall === 'healthy' || healthResult.overall === 'degraded';
      
      const statusCode = isReady ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE;
      
      return res.status(statusCode).json({
        ready: isReady,
        status: healthResult.overall,
        timestamp: new Date(),
      });
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        ready: false,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }

  /**
   * Liveness probe endpoint
   * For Kubernetes liveness probes
   */
  @Get('live')
  @ApiOperation({ 
    summary: 'Liveness probe',
    description: 'Kubernetes liveness probe endpoint'
  })
  async livenessProbe(@Res() res: Response) {
    try {
      // Basic check - if we can respond, we're alive
      return res.status(HttpStatus.OK).json({
        alive: true,
        timestamp: new Date(),
      });
    } catch (error) {
      return res.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        alive: false,
        error: error.message,
        timestamp: new Date(),
      });
    }
  }
}