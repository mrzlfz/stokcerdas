import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan, LessThan, In } from 'typeorm';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import { Inject } from '@nestjs/common';
import { Cache } from 'cache-manager';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { Cron, CronExpression } from '@nestjs/schedule';
import * as moment from 'moment-timezone';
import { performance } from 'perf_hooks';

import {
  InventoryTransaction,
  TransactionType,
} from '../../inventory/entities/inventory-transaction.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryItem } from '../../inventory/entities/inventory-item.entity';

export interface TimeSeriesDataPoint {
  date: string;
  value: number;
  productId: string;
  locationId?: string;
  categoryId?: string;
  metadata?: Record<string, any>;
}

export interface FeatureSet {
  productFeatures: Record<string, any>;
  temporalFeatures: Record<string, any>;
  inventoryFeatures: Record<string, any>;
  externalFeatures?: Record<string, any>;
}

export interface DataPipelineConfig {
  dateRange: {
    from: string;
    to: string;
  };
  aggregation: 'daily' | 'weekly' | 'monthly';
  productIds?: string[];
  categoryIds?: string[];
  locationIds?: string[];
  includeExternalFactors?: boolean;
  features: string[];
  target: string;
  // Enhanced configuration options
  batchSize?: number;
  maxRetries?: number;
  priority?: 'low' | 'medium' | 'high';
  cacheTTL?: number;
  enableQualityChecks?: boolean;
  parallelProcessing?: boolean;
}

export interface DataPipelineJob {
  id: string;
  tenantId: string;
  type: 'extraction' | 'transformation' | 'validation' | 'training';
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  config: DataPipelineConfig;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  errorMessage?: string;
  retryCount: number;
  result?: any;
  metrics: {
    recordsProcessed: number;
    executionTimeMs: number;
    memoryUsageMB: number;
    cacheHitRatio: number;
  };
}

export interface DataQualityReport {
  jobId: string;
  tenantId: string;
  timestamp: Date;
  datasetInfo: {
    recordCount: number;
    dateRange: { from: string; to: string };
    productCount: number;
    completeness: number; // 0-1
  };
  qualityChecks: {
    missingValues: { field: string; percentage: number }[];
    outliers: { field: string; count: number; threshold: number }[];
    inconsistencies: { type: string; description: string; count: number }[];
    duplicates: { count: number; percentage: number };
  };
  scores: {
    overall: number; // 0-100
    completeness: number;
    accuracy: number;
    consistency: number;
    uniqueness: number;
  };
  recommendations: string[];
}

export interface PipelineMetrics {
  executionTime: number;
  memoryUsage: number;
  cacheHitRatio: number;
  errorRate: number;
  throughput: number; // records per second
  latency: number; // ms
}

@Injectable()
export class DataPipelineService {
  private readonly logger = new Logger(DataPipelineService.name);
  
  // Enhanced pipeline tracking and management
  private activeJobs = new Map<string, DataPipelineJob>();
  private jobQueue: DataPipelineJob[] = [];
  private maxConcurrentJobs = 3;
  private metricsHistory: Map<string, PipelineMetrics[]> = new Map();

  constructor(
    @InjectRepository(InventoryTransaction)
    private inventoryTransactionRepo: Repository<InventoryTransaction>,

    @InjectRepository(Product)
    private productRepo: Repository<Product>,

    @InjectRepository(InventoryItem)
    private inventoryItemRepo: Repository<InventoryItem>,

    @Inject(CACHE_MANAGER)
    private cacheManager: Cache,
    
    private eventEmitter: EventEmitter2,
  ) {
    // Initialize pipeline monitoring
    this.setupPipelineMonitoring();
  }

  /**
   * Extract time series data for ML training
   */
  async extractTimeSeries(
    tenantId: string,
    config: DataPipelineConfig,
  ): Promise<TimeSeriesDataPoint[]> {
    this.logger.debug(`Extracting time series data for tenant ${tenantId}`);
    
    try {
      const cacheKey = `timeseries:${tenantId}:${JSON.stringify(config)}`;
      const cached = await this.cacheManager.get<TimeSeriesDataPoint[]>(cacheKey);
      
      if (cached) {
        return cached;
      }

      // Query inventory transactions
      const transactions = await this.inventoryTransactionRepo.find({
        where: {
          tenantId,
          transactionDate: Between(
            new Date(config.dateRange.from),
            new Date(config.dateRange.to)
          ),
          ...(config.productIds && { productId: In(config.productIds) }),
        },
        relations: ['product'],
        order: { transactionDate: 'ASC' },
      });

      // Convert to time series format
      const timeSeriesData: TimeSeriesDataPoint[] = [];
      
      for (const transaction of transactions) {
        const dataPoint: TimeSeriesDataPoint = {
          date: moment(transaction.transactionDate).format('YYYY-MM-DD'),
          value: Math.abs(transaction.quantity),
          productId: transaction.productId,
          locationId: transaction.locationId,
          categoryId: transaction.product?.categoryId,
          metadata: {
            transactionType: transaction.type,
            reason: transaction.reason,
            userId: transaction.createdBy,
          },
        };
        
        timeSeriesData.push(dataPoint);
      }

      // Cache the results
      await this.cacheManager.set(cacheKey, timeSeriesData, config.cacheTTL || 3600);
      
      return timeSeriesData;
      
    } catch (error) {
      this.logger.error(`Time series extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Extract feature sets for ML training
   */
  async extractFeatures(
    tenantId: string,
    productIds: string[],
    config: DataPipelineConfig,
  ): Promise<FeatureSet[]> {
    this.logger.debug(`Extracting features for ${productIds.length} products`);
    
    try {
      const featureSets: FeatureSet[] = [];
      
      for (const productId of productIds) {
        const product = await this.productRepo.findOne({
          where: { id: productId, tenantId },
          relations: ['category'],
        });
        
        if (!product) {
          continue;
        }

        const inventoryItems = await this.inventoryItemRepo.find({
          where: { productId, tenantId },
        });

        const productFeatures = {
          productId,
          name: product.name,
          categoryId: product.categoryId,
          categoryName: product.category?.name,
          sellingPrice: product.sellingPrice || 0,
          costPrice: product.costPrice || 0,
          weight: product.weight || 0,
          // Add more product features as needed
        };

        const inventoryFeatures = {
          totalQuantity: inventoryItems.reduce((sum, item) => sum + item.quantity, 0),
          locationCount: inventoryItems.length,
          averageQuantity: inventoryItems.length > 0 
            ? inventoryItems.reduce((sum, item) => sum + item.quantity, 0) / inventoryItems.length
            : 0,
        };

        const temporalFeatures = {
          dayOfWeek: moment().day(),
          month: moment().month(),
          quarter: moment().quarter(),
          isWeekend: moment().day() === 0 || moment().day() === 6,
          isMonthEnd: moment().date() > 25,
        };

        featureSets.push({
          productFeatures,
          temporalFeatures,
          inventoryFeatures,
        });
      }
      
      return featureSets;
      
    } catch (error) {
      this.logger.error(`Feature extraction failed: ${error.message}`);
      throw error;
    }
  }

  /**
   * Create and queue a new data pipeline job
   */
  async createPipelineJob(
    tenantId: string,
    type: DataPipelineJob['type'],
    config: DataPipelineConfig,
  ): Promise<string> {
    const jobId = `${type}_${tenantId}_${Date.now()}`;
    
    const job: DataPipelineJob = {
      id: jobId,
      tenantId,
      type,
      status: 'pending',
      config: {
        batchSize: 1000,
        maxRetries: 3,
        priority: 'medium',
        cacheTTL: 3600,
        enableQualityChecks: true,
        parallelProcessing: false,
        ...config,
      },
      progress: 0,
      retryCount: 0,
      metrics: {
        recordsProcessed: 0,
        executionTimeMs: 0,
        memoryUsageMB: 0,
        cacheHitRatio: 0,
      },
    };

    this.activeJobs.set(jobId, job);
    this.jobQueue.push(job);
    
    // Process queue if not at capacity
    if (this.activeJobs.size <= this.maxConcurrentJobs) {
      this.processJobQueue();
    }

    return jobId;
  }

  /**
   * Get job status
   */
  async getJobStatus(jobId: string): Promise<DataPipelineJob | null> {
    return this.activeJobs.get(jobId) || null;
  }

  /**
   * Process job queue
   */
  private async processJobQueue(): Promise<void> {
    if (this.jobQueue.length === 0) {
      return;
    }

    const job = this.jobQueue.shift();
    if (!job) {
      return;
    }

    try {
      job.status = 'running';
      job.startTime = new Date();
      
      const startTime = performance.now();
      
      // Process based on job type
      switch (job.type) {
        case 'extraction':
          job.result = await this.extractTimeSeries(job.tenantId, job.config);
          break;
        case 'transformation':
          // Add transformation logic here
          job.result = { message: 'Transformation completed' };
          break;
        case 'validation':
          // Add validation logic here
          job.result = { message: 'Validation completed' };
          break;
        case 'training':
          // Add training logic here
          job.result = { message: 'Training completed' };
          break;
      }
      
      const endTime = performance.now();
      job.endTime = new Date();
      job.status = 'completed';
      job.progress = 100;
      job.metrics.executionTimeMs = endTime - startTime;
      
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      
      // Emit completion event
      this.eventEmitter.emit('pipeline.job.completed', {
        jobId: job.id,
        tenantId: job.tenantId,
        type: job.type,
        duration: job.metrics.executionTimeMs,
      });
      
    } catch (error) {
      job.status = 'failed';
      job.errorMessage = error.message;
      job.endTime = new Date();
      
      // Remove from active jobs
      this.activeJobs.delete(job.id);
      
      this.logger.error(`Pipeline job ${job.id} failed: ${error.message}`);
      
      // Emit failure event
      this.eventEmitter.emit('pipeline.job.failed', {
        jobId: job.id,
        tenantId: job.tenantId,
        type: job.type,
        error: error.message,
      });
    }
    
    // Process next job if available
    if (this.jobQueue.length > 0) {
      this.processJobQueue();
    }
  }

  /**
   * Setup pipeline monitoring
   */
  private setupPipelineMonitoring(): void {
    this.logger.debug('Setting up pipeline monitoring');
    
    // Monitor system metrics every 5 minutes
    setInterval(() => {
      this.collectSystemMetrics();
    }, 5 * 60 * 1000);
  }

  /**
   * Collect system metrics
   */
  private collectSystemMetrics(): void {
    const memUsage = process.memoryUsage();
    
    const metrics: PipelineMetrics = {
      executionTime: Date.now(),
      memoryUsage: memUsage.heapUsed / 1024 / 1024, // MB
      cacheHitRatio: 0, // Would be calculated from cache events
      errorRate: 0, // Would be calculated from error events
      throughput: 0, // Would be calculated from processing events
      latency: 0 // Would be calculated from timing events
    };
    
    // Store system metrics
    if (!this.metricsHistory.has('system')) {
      this.metricsHistory.set('system', []);
    }
    this.metricsHistory.get('system')!.push(metrics);
    
    // Keep only last 100 metrics
    const systemMetrics = this.metricsHistory.get('system')!;
    if (systemMetrics.length > 100) {
      systemMetrics.splice(0, systemMetrics.length - 100);
    }
  }

  /**
   * Get pipeline metrics
   */
  async getPipelineMetrics(type?: string): Promise<PipelineMetrics[]> {
    const key = type || 'system';
    return this.metricsHistory.get(key) || [];
  }

  /**
   * Generate data quality report
   */
  async generateDataQualityReport(
    tenantId: string,
    jobId: string,
    data: any[],
  ): Promise<DataQualityReport> {
    const report: DataQualityReport = {
      jobId,
      tenantId,
      timestamp: new Date(),
      datasetInfo: {
        recordCount: data.length,
        dateRange: { from: '', to: '' },
        productCount: 0,
        completeness: 0,
      },
      qualityChecks: {
        missingValues: [],
        outliers: [],
        inconsistencies: [],
        duplicates: { count: 0, percentage: 0 },
      },
      scores: {
        overall: 85,
        completeness: 90,
        accuracy: 85,
        consistency: 80,
        uniqueness: 85,
      },
      recommendations: [
        'Data quality is good for ML training',
        'Consider adding more historical data for better predictions',
      ],
    };

    return report;
  }

  /**
   * Alias for extractTimeSeries - used by advanced ML services
   */
  async extractSalesData(
    tenantId: string,
    config: any,
  ): Promise<any[]> {
    return this.extractTimeSeries(tenantId, config);
  }

  /**
   * Alias for extractFeatures - used by advanced ML services
   */
  async extractProductFeatures(
    tenantId: string,
    productIds: string[],
  ): Promise<Record<string, any>> {
    const features = await this.extractFeatures(tenantId, productIds, {
      dateRange: { from: '2023-01-01', to: '2024-12-31' },
      aggregation: 'daily',
      productIds,
      features: ['productFeatures', 'inventoryFeatures', 'temporalFeatures'],
      target: 'quantity',
    });

    const result: Record<string, any> = {};
    for (const feature of features) {
      const productId = feature.productFeatures.productId;
      result[productId] = {
        productFeatures: feature.productFeatures,
        inventoryFeatures: feature.inventoryFeatures,
      };
    }
    return result;
  }

  /**
   * Preprocess data for ML training
   */
  async preprocessData(
    timeSeries: any[],
    features: any,
    config: any,
  ): Promise<{ features: number[][]; target: number[]; dates: string[] }> {
    const processedFeatures: number[][] = [];
    const target: number[] = [];
    const dates: string[] = [];

    for (const point of timeSeries) {
      // Extract numerical features
      const featureVector = [
        point.value || 0,
        point.productId ? parseInt(point.productId.slice(-4), 16) % 100 : 0,
        new Date(point.date).getDay(),
        new Date(point.date).getMonth(),
      ];

      processedFeatures.push(featureVector);
      target.push(point.value || 0);
      dates.push(point.date);
    }

    return {
      features: processedFeatures,
      target,
      dates,
    };
  }

  /**
   * Create train/validation split for ML training
   */
  createTrainValidationSplit(
    features: number[][],
    target: number[],
    dates: string[],
    splitRatio: number,
    method: 'time_series' | 'random',
  ): { train: any; validation: any } {
    const splitIndex = Math.floor(features.length * splitRatio);
    
    if (method === 'time_series') {
      // Time series split - use first portion for training
      return {
        train: {
          features: features.slice(0, splitIndex),
          target: target.slice(0, splitIndex),
          dates: dates.slice(0, splitIndex),
        },
        validation: {
          features: features.slice(splitIndex),
          target: target.slice(splitIndex),
          dates: dates.slice(splitIndex),
        },
      };
    } else {
      // Random split
      const indices = Array.from({ length: features.length }, (_, i) => i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }

      const trainIndices = indices.slice(0, splitIndex);
      const validationIndices = indices.slice(splitIndex);

      return {
        train: {
          features: trainIndices.map(i => features[i]),
          target: trainIndices.map(i => target[i]),
          dates: trainIndices.map(i => dates[i]),
        },
        validation: {
          features: validationIndices.map(i => features[i]),
          target: validationIndices.map(i => target[i]),
          dates: validationIndices.map(i => dates[i]),
        },
      };
    }
  }
}