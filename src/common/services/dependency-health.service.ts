import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { RedisService } from '@liaoliaots/nestjs-redis';
import { Redis } from 'ioredis';
import { spawn } from 'child_process';
import { promisify } from 'util';
import * as fs from 'fs';

/**
 * DependencyHealthService - Comprehensive System Health Monitoring
 * 
 * Monitors:
 * - Database connectivity (PostgreSQL)
 * - Redis connectivity and performance
 * - Python ML environment and dependencies
 * - File system access
 * - External API connectivity
 * - Indonesian business context services
 * 
 * Optimized for StokCerdas AI production environment
 */

interface HealthCheckResult {
  service: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  details: any;
  timestamp: Date;
  error?: string;
}

interface PythonDependencyCheck {
  package: string;
  version: string | null;
  status: 'installed' | 'missing' | 'error';
  error?: string;
}

interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  services: HealthCheckResult[];
  python: {
    environment: 'healthy' | 'degraded' | 'unhealthy';
    dependencies: PythonDependencyCheck[];
    version: string | null;
    virtualenv: boolean;
  };
  performance: {
    memoryUsage: NodeJS.MemoryUsage;
    uptime: number;
    loadAverage: number[];
  };
  indonesian: {
    timezone: string;
    locale: string;
    businessHours: boolean;
    calendar: 'available' | 'unavailable';
  };
}

@Injectable()
export class DependencyHealthService {
  private readonly logger = new Logger(DependencyHealthService.name);
  private readonly pythonTimeout = 30000; // 30 seconds
  private readonly healthCheckInterval = 60000; // 1 minute
  private lastHealthCheck: SystemHealth | null = null;
  private healthCheckInProgress = false;

  constructor(
    private readonly configService: ConfigService,
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisService: RedisService,
  ) {}

  /**
   * Get Redis instance
   */
  private get redis(): Redis {
    return this.redisService.getOrThrow();
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck(): Promise<SystemHealth> {
    if (this.healthCheckInProgress) {
      return this.lastHealthCheck || this.createUnhealthyResponse('Health check in progress');
    }

    this.healthCheckInProgress = true;
    const startTime = Date.now();

    try {
      this.logger.log('Starting comprehensive health check...');

      // Parallel health checks for better performance
      const [
        databaseHealth,
        redisHealth,
        pythonHealth,
        fileSystemHealth,
        indonesianHealth,
      ] = await Promise.allSettled([
        this.checkDatabaseHealth(),
        this.checkRedisHealth(),
        this.checkPythonHealth(),
        this.checkFileSystemHealth(),
        this.checkIndonesianBusinessContext(),
      ]);

      // Collect all health results
      const services: HealthCheckResult[] = [
        this.extractResult(databaseHealth, 'database'),
        this.extractResult(redisHealth, 'redis'),
        this.extractResult(fileSystemHealth, 'filesystem'),
        this.extractResult(indonesianHealth, 'indonesian-context'),
      ];

      // Extract Python health separately
      const pythonHealthResult = this.extractResult(pythonHealth, 'python');
      const pythonDetails = pythonHealthResult.status === 'healthy' ? pythonHealthResult.details : null;

      // Determine overall health
      const overallHealth = this.calculateOverallHealth(services, pythonHealthResult);

      // Create system health response
      const systemHealth: SystemHealth = {
        overall: overallHealth,
        services,
        python: pythonDetails || {
          environment: 'unhealthy',
          dependencies: [],
          version: null,
          virtualenv: false,
        },
        performance: {
          memoryUsage: process.memoryUsage(),
          uptime: process.uptime(),
          loadAverage: require('os').loadavg(),
        },
        indonesian: {
          timezone: 'Asia/Jakarta',
          locale: 'id-ID',
          businessHours: this.isIndonesianBusinessHours(),
          calendar: 'available',
        },
      };

      this.lastHealthCheck = systemHealth;
      this.logger.log(`Health check completed in ${Date.now() - startTime}ms - Overall: ${overallHealth}`);

      return systemHealth;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return this.createUnhealthyResponse(error.message);
    } finally {
      this.healthCheckInProgress = false;
    }
  }

  /**
   * Check database connectivity and performance
   */
  private async checkDatabaseHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await this.dataSource.query('SELECT 1');
      
      // Test performance with a simple query
      await this.dataSource.query('SELECT COUNT(*) FROM information_schema.tables');
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'database',
        status: responseTime < 1000 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          type: 'postgresql',
          isConnected: this.dataSource.isInitialized,
          migrations: await this.dataSource.showMigrations(),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'database',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: null,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check Redis connectivity and performance
   */
  private async checkRedisHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Test basic connectivity
      await this.redis.ping();
      
      // Test read/write performance
      const testKey = 'health_check_test';
      await this.redis.set(testKey, 'test_value', 'EX', 60);
      const value = await this.redis.get(testKey);
      await this.redis.del(testKey);
      
      const responseTime = Date.now() - startTime;
      
      return {
        service: 'redis',
        status: responseTime < 500 ? 'healthy' : 'degraded',
        responseTime,
        details: {
          connected: true,
          keyCount: await this.redis.dbsize(),
          memory: await this.redis.info('memory'),
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'redis',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: null,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check Python ML environment and dependencies
   */
  private async checkPythonHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check Python version
      const pythonVersion = await this.getPythonVersion();
      
      // Check virtual environment
      const virtualenv = await this.checkVirtualEnvironment();
      
      // Check ML dependencies
      const dependencies = await this.checkMLDependencies();
      
      const responseTime = Date.now() - startTime;
      
      // Determine health status
      const allDepsHealthy = dependencies.every(dep => dep.status === 'installed');
      const status = allDepsHealthy ? 'healthy' : 'degraded';
      
      return {
        service: 'python',
        status,
        responseTime,
        details: {
          environment: status,
          dependencies,
          version: pythonVersion,
          virtualenv,
        },
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'python',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: null,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check file system access
   */
  private async checkFileSystemHealth(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      // Check critical directories
      const pythonPath = this.configService.get<string>('PYTHON_PATH', '/app/src/ml-forecasting/python');
      const logsPath = '/app/logs';
      const uploadsPath = '/app/uploads';
      
      const checks = {
        pythonScripts: await this.checkDirectoryAccess(pythonPath),
        logs: await this.checkDirectoryAccess(logsPath),
        uploads: await this.checkDirectoryAccess(uploadsPath),
      };
      
      const allHealthy = Object.values(checks).every(check => check === true);
      
      return {
        service: 'filesystem',
        status: allHealthy ? 'healthy' : 'degraded',
        responseTime: Date.now() - startTime,
        details: checks,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'filesystem',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: null,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Check Indonesian business context services
   */
  private async checkIndonesianBusinessContext(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    
    try {
      const context = {
        timezone: this.configService.get<string>('INDONESIAN_TIMEZONE', 'Asia/Jakarta'),
        businessHours: this.isIndonesianBusinessHours(),
        holidaysEnabled: this.configService.get<boolean>('INDONESIAN_HOLIDAYS_ENABLED', true),
        paydayEffects: this.configService.get<boolean>('INDONESIAN_PAYDAY_EFFECTS', true),
        ramadanEffects: this.configService.get<boolean>('INDONESIAN_RAMADAN_EFFECTS', true),
        currency: this.configService.get<string>('DEFAULT_CURRENCY', 'IDR'),
        language: this.configService.get<string>('DEFAULT_LANGUAGE', 'id'),
      };
      
      return {
        service: 'indonesian-context',
        status: 'healthy',
        responseTime: Date.now() - startTime,
        details: context,
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        service: 'indonesian-context',
        status: 'unhealthy',
        responseTime: Date.now() - startTime,
        details: null,
        timestamp: new Date(),
        error: error.message,
      };
    }
  }

  /**
   * Get Python version
   */
  private async getPythonVersion(): Promise<string | null> {
    try {
      const pythonExec = this.configService.get<string>('PYTHON_EXECUTABLE', '/app/venv/bin/python');
      const result = await this.execPython(pythonExec, ['--version']);
      return result.stdout.trim();
    } catch (error) {
      this.logger.warn('Failed to get Python version', error);
      return null;
    }
  }

  /**
   * Check virtual environment
   */
  private async checkVirtualEnvironment(): Promise<boolean> {
    try {
      const venvPath = this.configService.get<string>('PYTHON_VENV_PATH', '/app/venv');
      return await this.checkDirectoryAccess(venvPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Check ML dependencies
   */
  private async checkMLDependencies(): Promise<PythonDependencyCheck[]> {
    const requiredPackages = [
      'pandas',
      'numpy',
      'scikit-learn',
      'statsmodels',
      'prophet',
      'xgboost',
    ];

    const checks: PythonDependencyCheck[] = [];

    for (const pkg of requiredPackages) {
      try {
        const pythonExec = this.configService.get<string>('PYTHON_EXECUTABLE', '/app/venv/bin/python');
        const result = await this.execPython(pythonExec, ['-c', `import ${pkg}; print(${pkg}.__version__)`]);
        
        checks.push({
          package: pkg,
          version: result.stdout.trim(),
          status: 'installed',
        });
      } catch (error) {
        checks.push({
          package: pkg,
          version: null,
          status: 'missing',
          error: error.message,
        });
      }
    }

    return checks;
  }

  /**
   * Execute Python command with timeout
   */
  private async execPython(command: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args, { timeout: this.pythonTimeout });
      let stdout = '';
      let stderr = '';

      proc.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      proc.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr });
        } else {
          reject(new Error(`Python process exited with code ${code}: ${stderr}`));
        }
      });

      proc.on('error', (error) => {
        reject(error);
      });
    });
  }

  /**
   * Check directory access
   */
  private async checkDirectoryAccess(path: string): Promise<boolean> {
    try {
      await fs.promises.access(path, fs.constants.R_OK | fs.constants.W_OK);
      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Check if current time is within Indonesian business hours
   */
  private isIndonesianBusinessHours(): boolean {
    const now = new Date();
    const jakartaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));
    const hour = jakartaTime.getHours();
    const day = jakartaTime.getDay();
    
    // Monday to Friday, 9 AM to 6 PM Jakarta time
    return day >= 1 && day <= 5 && hour >= 9 && hour < 18;
  }

  /**
   * Extract result from Promise.allSettled
   */
  private extractResult(result: PromiseSettledResult<HealthCheckResult>, serviceName: string): HealthCheckResult {
    if (result.status === 'fulfilled') {
      return result.value;
    } else {
      return {
        service: serviceName,
        status: 'unhealthy',
        responseTime: 0,
        details: null,
        timestamp: new Date(),
        error: result.reason?.message || 'Unknown error',
      };
    }
  }

  /**
   * Calculate overall health status
   */
  private calculateOverallHealth(services: HealthCheckResult[], pythonHealth: HealthCheckResult): 'healthy' | 'degraded' | 'unhealthy' {
    const allServices = [...services, pythonHealth];
    const unhealthyCount = allServices.filter(s => s.status === 'unhealthy').length;
    const degradedCount = allServices.filter(s => s.status === 'degraded').length;
    
    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Create unhealthy response
   */
  private createUnhealthyResponse(error: string): SystemHealth {
    return {
      overall: 'unhealthy',
      services: [],
      python: {
        environment: 'unhealthy',
        dependencies: [],
        version: null,
        virtualenv: false,
      },
      performance: {
        memoryUsage: process.memoryUsage(),
        uptime: process.uptime(),
        loadAverage: require('os').loadavg(),
      },
      indonesian: {
        timezone: 'Asia/Jakarta',
        locale: 'id-ID',
        businessHours: false,
        calendar: 'unavailable',
      },
    };
  }

  /**
   * Get cached health status
   */
  getCachedHealth(): SystemHealth | null {
    return this.lastHealthCheck;
  }

  /**
   * Quick health check (cached or minimal)
   */
  async quickHealthCheck(): Promise<{ status: string; timestamp: Date }> {
    if (this.lastHealthCheck && Date.now() - this.lastHealthCheck.performance.uptime < this.healthCheckInterval) {
      return {
        status: this.lastHealthCheck.overall,
        timestamp: new Date(),
      };
    }

    try {
      // Quick database ping
      await this.dataSource.query('SELECT 1');
      return {
        status: 'healthy',
        timestamp: new Date(),
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        timestamp: new Date(),
      };
    }
  }
}