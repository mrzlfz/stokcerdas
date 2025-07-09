import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bull';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { HttpModule } from '@nestjs/axios';

// Import required entities for analytics
import { InventoryItem } from '../inventory/entities/inventory-item.entity';
import { InventoryTransaction } from '../inventory/entities/inventory-transaction.entity';
import { InventoryLocation } from '../inventory/entities/inventory-location.entity';
import { Product } from '../products/entities/product.entity';
import { ProductCategory } from '../products/entities/product-category.entity';

// Import customer entities for customer business intelligence
import { Customer } from '../customers/entities/customer.entity';

// Import ML forecasting entities for advanced analytics
import { Prediction } from '../ml-forecasting/entities/prediction.entity';
import { MLModel } from '../ml-forecasting/entities/ml-model.entity';

// Import analytics-specific entities
import { IndustryBenchmark } from './entities/industry-benchmark.entity';

// Import services
import { BusinessIntelligenceService } from './services/business-intelligence.service';
import { CustomMetricsService } from './services/custom-metrics.service';
import { BenchmarkingService } from './services/benchmarking.service';
import { CustomerInsightsService } from './services/customer-insights.service';
import { CustomerBusinessIntelligenceService } from './services/customer-business-intelligence.service';
import { UnifiedDashboardAggregatorService } from './services/unified-dashboard-aggregator.service';
import { SimilarityEngineService } from './services/similarity-engine.service';
import { IndustryDataIntegrationService } from './services/industry-data-integration.service';
import { BankIndonesiaIntegrationService } from './services/bank-indonesia-integration.service';
import { PredictiveAnalyticsService } from './services/predictive-analytics.service';
import { PriceOptimizationService } from './services/price-optimization.service';
import { DemandAnomalyService } from './services/demand-anomaly.service';
// import { MarketplaceDataIntegrationInfrastructureService } from './services/marketplace-data-integration-infrastructure.service';
// import { RealtimeCompetitivePriceMonitoringService } from './services/realtime-competitive-price-monitoring.service';
// import { ProductCompetitionIntelligenceAnalysisService } from './services/product-competition-intelligence-analysis.service';
// Temporarily disabled due to missing type definitions
// import { MarketIntelligenceAggregationService } from './services/market-intelligence-aggregation.service';
// import { CompetitiveIntelligenceValidationQAService } from './services/competitive-intelligence-validation-qa.service';
// import { PerformanceMetricsCollectionInfrastructureService } from './services/performance-metrics-collection-infrastructure.service';
// import { ValidationAlgorithmsFrameworkEngineService } from './services/validation-algorithms-framework-engine.service';
// import { IndonesianBusinessPerformanceStandardsIntegrationService } from './services/indonesian-business-performance-standards-integration.service';
// import { RealTimePerformanceMonitoringAlertingService } from './services/realtime-performance-monitoring-alerting.service';
// import { PerformanceOptimizationRecommendationsService } from './services/performance-optimization-recommendations.service';
// import { PerformanceValidationIntegrationOrchestratorService } from './services/performance-validation-integration-orchestrator.service';
// Temporary disabled services due to missing type definitions
// import { AdvancedPerformanceBenchmarkingIntegrationService } from './services/advanced-performance-benchmarking-integration.service';
// import { CrossSystemValidationCoordinationEngineService } from './services/cross-system-validation-coordination-engine.service';
// import { PerformanceValidationAutomationFrameworkService } from './services/performance-validation-automation-framework.service';
// import { RealTimeMarketDataAggregationEngineService } from './services/realtime-market-data-aggregation-engine.service';
// import { CompetitivePricingIntelligenceSystemService } from './services/competitive-pricing-intelligence-system.service';
// import { ProductLifecycleIntelligenceAnalysisService } from './services/product-lifecycle-intelligence-analysis.service';
// import { MarketSharePositionIntelligenceService } from './services/market-share-position-intelligence.service';
// import { CompetitiveStrategyIntelligenceIntegrationService } from './services/competitive-strategy-intelligence-integration.service';
// import { EnterprisePerformanceGovernanceSystemService } from './services/enterprise-performance-governance-system.service';

// Import ML Forecasting module for service integration
import { MLForecastingModule } from '../ml-forecasting/ml-forecasting.module';

// Import Customers module for customer analytics integration
import { CustomersModule } from '../customers/customers.module';

// Import controllers
import { AnalyticsController } from './controllers/analytics.controller';
import { PredictiveAnalyticsController } from './controllers/predictive-analytics.controller';
import { CustomerBusinessIntelligenceController } from './controllers/customer-business-intelligence.controller';
import { UnifiedDashboardController } from './controllers/unified-dashboard.controller';

// Import processors for async analytics
import { AnalyticsProcessor } from './processors/analytics.processor';

@Module({
  imports: [
    ConfigModule,
    EventEmitterModule,
    HttpModule.register({
      timeout: 30000,
      maxRedirects: 3,
    }),

    // Database entities for analytics
    TypeOrmModule.forFeature([
      // Core inventory and product entities
      InventoryItem,
      InventoryTransaction,
      InventoryLocation,
      Product,
      ProductCategory,

      // Customer entities for customer business intelligence
      Customer,

      // ML entities for advanced analytics
      Prediction,
      MLModel,

      // Analytics-specific entities
      IndustryBenchmark,
    ]),

    // Bull queue for async analytics processing
    BullModule.registerQueue({
      name: 'analytics',
      defaultJobOptions: {
        removeOnComplete: 50, // Keep more completed jobs for analytics history
        removeOnFail: 25,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 5000,
        },
      },
    }),

    // Import ML Forecasting module for service integration (using forwardRef to avoid circular dependency)
    forwardRef(() => MLForecastingModule),

    // Import Customers module for customer analytics integration
    CustomersModule,
  ],

  controllers: [
    AnalyticsController,
    PredictiveAnalyticsController,
    CustomerBusinessIntelligenceController,
    UnifiedDashboardController,
  ],

  providers: [
    // Core analytics services
    BusinessIntelligenceService,
    CustomMetricsService,
    BenchmarkingService,
    CustomerInsightsService,
    CustomerBusinessIntelligenceService,
    UnifiedDashboardAggregatorService,
    SimilarityEngineService,
    IndustryDataIntegrationService,
    BankIndonesiaIntegrationService,

    // Predictive analytics services
    PredictiveAnalyticsService,
    PriceOptimizationService,
    DemandAnomalyService,

    // Competitive intelligence services
    // MarketplaceDataIntegrationInfrastructureService,
    // RealtimeCompetitivePriceMonitoringService,
    // ProductCompetitionIntelligenceAnalysisService,
    // MarketIntelligenceAggregationService,
    // CompetitiveIntelligenceValidationQAService,

    // Performance metrics services
    // PerformanceMetricsCollectionInfrastructureService,
    // ValidationAlgorithmsFrameworkEngineService,
    // IndonesianBusinessPerformanceStandardsIntegrationService,
    // RealTimePerformanceMonitoringAlertingService,
    // PerformanceOptimizationRecommendationsService,
    // PerformanceValidationIntegrationOrchestratorService,
    // Temporary disabled services
    // AdvancedPerformanceBenchmarkingIntegrationService,
    // CrossSystemValidationCoordinationEngineService,
    // PerformanceValidationAutomationFrameworkService,

    // Real competitive intelligence data services (temporary disabled)
    // RealTimeMarketDataAggregationEngineService,
    // CompetitivePricingIntelligenceSystemService,
    // ProductLifecycleIntelligenceAnalysisService,
    // MarketSharePositionIntelligenceService,
    // CompetitiveStrategyIntelligenceIntegrationService,
    // EnterprisePerformanceGovernanceSystemService,

    // Note: ML Forecasting services are now provided by MLForecastingModule

    // Queue processors
    AnalyticsProcessor,
  ],

  exports: [
    // Export analytics services for use in other modules
    BusinessIntelligenceService,
    CustomMetricsService,
    BenchmarkingService,
    CustomerInsightsService,
    CustomerBusinessIntelligenceService,
    UnifiedDashboardAggregatorService,
    SimilarityEngineService,
    IndustryDataIntegrationService,
    BankIndonesiaIntegrationService,
    PredictiveAnalyticsService,
    PriceOptimizationService,
    DemandAnomalyService,
    // MarketplaceDataIntegrationInfrastructureService,
    // RealtimeCompetitivePriceMonitoringService,
    // ProductCompetitionIntelligenceAnalysisService,
    // MarketIntelligenceAggregationService,
    // CompetitiveIntelligenceValidationQAService,
    // PerformanceMetricsCollectionInfrastructureService,
    // ValidationAlgorithmsFrameworkEngineService,
    // IndonesianBusinessPerformanceStandardsIntegrationService,
    // RealTimePerformanceMonitoringAlertingService,
    // PerformanceOptimizationRecommendationsService,
    // PerformanceValidationIntegrationOrchestratorService,
    // Temporary disabled exports
    // AdvancedPerformanceBenchmarkingIntegrationService,
    // CrossSystemValidationCoordinationEngineService,
    // PerformanceValidationAutomationFrameworkService,
    // RealTimeMarketDataAggregationEngineService,
    // CompetitivePricingIntelligenceSystemService,
    // ProductLifecycleIntelligenceAnalysisService,
    // MarketSharePositionIntelligenceService,
    // CompetitiveStrategyIntelligenceIntegrationService,
    // EnterprisePerformanceGovernanceSystemService,
  ],
})
export class AnalyticsModule {}
