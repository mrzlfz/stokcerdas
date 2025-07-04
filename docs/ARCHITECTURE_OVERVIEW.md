# 🏗️ StokCerdas Architecture Overview

**Technical Architecture Documentation for Developers & System Architects**

---

## 📋 Table of Contents

1. [System Overview](#system-overview)
2. [Technology Stack](#technology-stack)
3. [Multi-Tenant Architecture](#multi-tenant-architecture)
4. [Database Design](#database-design)
5. [API Architecture](#api-architecture)
6. [Real-time System](#real-time-system)
7. [Integration Layer](#integration-layer)
8. [Mobile Architecture](#mobile-architecture)
9. [Security Framework](#security-framework)
10. [Performance & Scalability](#performance--scalability)
11. [Deployment Architecture](#deployment-architecture)
12. [Monitoring & Observability](#monitoring--observability)

---

## 🌟 System Overview

### **Platform Purpose**
StokCerdas is an enterprise-grade, AI-powered inventory intelligence platform specifically designed for Indonesian SMBs. The platform combines traditional inventory management with advanced machine learning capabilities to provide predictive analytics, automated reordering, and real-time multi-channel synchronization.

### **Core Principles**
- **Multi-tenant SaaS**: Secure tenant isolation with shared infrastructure
- **Mobile-first**: Optimized for Indonesian SMB usage patterns (85% mobile)
- **Real-time**: WebSocket-based real-time updates across all clients
- **API-first**: Comprehensive REST API with extensive integration capabilities
- **Scalable**: Designed to handle 10,000+ concurrent users
- **Localized**: Indonesian business context, payment methods, and logistics

### **High-Level Architecture**
```mermaid
graph TB
    subgraph "Client Layer"
        WEB[Web Dashboard]
        MOBILE[Mobile App]
        API_CLIENT[API Clients]
    end
    
    subgraph "API Gateway"
        NGINX[Nginx Load Balancer]
        AUTH[Authentication Service]
        RATE[Rate Limiting]
    end
    
    subgraph "Application Layer"
        NESTJS[NestJS Backend]
        WEBSOCKET[WebSocket Gateway]
        WORKERS[Background Workers]
    end
    
    subgraph "Integration Layer"
        SHOPEE[Shopee API]
        TOKOPEDIA[Tokopedia API]
        LAZADA[Lazada API]
        WHATSAPP[WhatsApp API]
        LOGISTICS[Logistics APIs]
    end
    
    subgraph "Data Layer"
        POSTGRES[(PostgreSQL)]
        REDIS[(Redis Cache)]
        ELASTICSEARCH[(Elasticsearch)]
        S3[(Object Storage)]
    end
    
    subgraph "ML/AI Layer"
        FORECAST[Forecasting Models]
        OPTIMIZATION[Optimization Engine]
        ANALYTICS[Analytics Pipeline]
    end
    
    WEB --> NGINX
    MOBILE --> NGINX
    API_CLIENT --> NGINX
    NGINX --> AUTH
    AUTH --> NESTJS
    NESTJS --> WEBSOCKET
    NESTJS --> WORKERS
    NESTJS --> POSTGRES
    NESTJS --> REDIS
    NESTJS --> ELASTICSEARCH
    NESTJS --> S3
    WORKERS --> FORECAST
    WORKERS --> OPTIMIZATION
    NESTJS --> SHOPEE
    NESTJS --> TOKOPEDIA
    NESTJS --> LAZADA
    NESTJS --> WHATSAPP
    NESTJS --> LOGISTICS
```

---

## 🛠️ Technology Stack

### **Backend Technologies**
```yaml
Runtime:
  - Node.js: v18+ (LTS)
  - TypeScript: v5+
  
Framework:
  - NestJS: v10+
  - Express.js: Underlying HTTP server
  - Socket.io: Real-time communication
  
ORM & Database:
  - TypeORM: v0.3+ (Database abstraction)
  - PostgreSQL: v15+ (Primary database)
  - Redis: v7+ (Caching & sessions)
  
Queue & Jobs:
  - Bull: Redis-based job queues
  - Cron: Scheduled tasks
  
Search & Analytics:
  - Elasticsearch: v8+ (Search engine)
  - Kibana: Analytics dashboard
  
File Storage:
  - AWS S3: Production storage
  - MinIO: Development storage
  
Messaging:
  - RabbitMQ: Message broker
  - AMQP: Protocol
```

### **Frontend Technologies**
```yaml
Mobile (React Native):
  - React Native: v0.72+
  - TypeScript: v5+
  - React Navigation: v6+
  - Redux Toolkit: State management
  - RTK Query: API client
  - React Hook Form: Form handling
  - React Native Camera: Barcode scanning
  
Web Dashboard:
  - React: v18+
  - TypeScript: v5+
  - Next.js: v13+ (Full-stack framework)
  - Material-UI: Component library
  - Redux Toolkit: State management
  - React Query: Server state
  
Dev Tools:
  - ESLint: Code linting
  - Prettier: Code formatting
  - Jest: Testing framework
  - Storybook: Component development
```

### **AI/ML Stack**
```yaml
Languages:
  - Python: v3.11+
  - R: v4+ (Statistical analysis)
  
Libraries:
  - scikit-learn: Machine learning
  - pandas: Data manipulation
  - numpy: Numerical computing
  - Prophet: Time series forecasting
  - XGBoost: Gradient boosting
  - TensorFlow: Deep learning
  
Deployment:
  - Docker: Containerization
  - MLflow: Model lifecycle
  - Apache Airflow: Pipeline orchestration
```

### **Infrastructure Technologies**
```yaml
Containerization:
  - Docker: v24+
  - Docker Compose: Development
  - Kubernetes: Production orchestration
  
Cloud & CDN:
  - AWS: Primary cloud provider
  - CloudFront: CDN
  - Route 53: DNS
  - ALB: Load balancing
  
Monitoring:
  - Prometheus: Metrics collection
  - Grafana: Visualization
  - Jaeger: Distributed tracing
  - ELK Stack: Logging
  
Security:
  - Let's Encrypt: SSL certificates
  - AWS WAF: Web application firewall
  - Vault: Secret management
```

---

## 🏢 Multi-Tenant Architecture

### **Tenant Isolation Strategy**
StokCerdas implements a **hybrid multi-tenancy** approach combining shared infrastructure with logical data isolation.

#### **Row-Level Security (RLS)**
```sql
-- Example tenant isolation in PostgreSQL
CREATE POLICY tenant_isolation ON products
    FOR ALL TO app_user
    USING (tenant_id = current_setting('app.current_tenant_id'));

-- All tables include tenant_id column
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    -- ... other columns
    UNIQUE(tenant_id, sku)
);
```

#### **Tenant Context Middleware**
```typescript
@Injectable()
export class TenantMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const tenantId = this.extractTenantId(req);
    
    // Set tenant context for database operations
    req['tenantId'] = tenantId;
    
    // Set PostgreSQL session variable
    // All subsequent queries automatically filtered by tenant
    next();
  }
  
  private extractTenantId(req: Request): string {
    // Extract from JWT token
    const token = req.headers.authorization?.replace('Bearer ', '');
    const decoded = jwt.decode(token) as any;
    return decoded.tenantId;
  }
}
```

### **Tenant Data Structure**
```typescript
// Tenant entity
@Entity('tenants')
export class Tenant {
  @PrimaryGeneratedColumn('uuid')
  id: string;
  
  @Column()
  name: string;
  
  @Column()
  subdomain: string;
  
  @Column({ type: 'enum', enum: PlanType })
  plan: PlanType;
  
  @Column({ type: 'jsonb' })
  settings: {
    timezone: string;
    currency: string;
    businessType: string;
    features: string[];
  };
  
  @Column({ type: 'jsonb' })
  limits: {
    maxProducts: number;
    maxUsers: number;
    maxIntegrations: number;
    maxStorageGB: number;
  };
  
  @CreateDateColumn()
  createdAt: Date;
  
  @UpdateDateColumn()
  updatedAt: Date;
}
```

### **Resource Isolation**
```typescript
// Database connection per tenant (for large enterprise clients)
@Injectable()
export class TenantDatabaseService {
  private connections = new Map<string, DataSource>();
  
  async getConnection(tenantId: string): Promise<DataSource> {
    if (!this.connections.has(tenantId)) {
      const tenant = await this.getTenant(tenantId);
      
      if (tenant.plan === 'enterprise' && tenant.settings.dedicatedDb) {
        // Enterprise tenants get dedicated database
        const connection = new DataSource({
          type: 'postgres',
          host: tenant.dbConfig.host,
          database: tenant.dbConfig.database,
          // ... dedicated DB config
        });
        
        this.connections.set(tenantId, connection);
      }
    }
    
    return this.connections.get(tenantId) || this.defaultConnection;
  }
}
```

---

## 🗄️ Database Design

### **Core Entity Relationships**
```mermaid
erDiagram
    TENANT ||--o{ USER : has
    TENANT ||--o{ COMPANY : owns
    COMPANY ||--o{ DEPARTMENT : contains
    COMPANY ||--o{ LOCATION : has
    
    TENANT ||--o{ PRODUCT : contains
    PRODUCT ||--o{ PRODUCT_VARIANT : has
    PRODUCT }o--|| CATEGORY : belongs_to
    
    PRODUCT ||--o{ INVENTORY_ITEM : tracked_in
    LOCATION ||--o{ INVENTORY_ITEM : stores
    INVENTORY_ITEM ||--o{ INVENTORY_TRANSACTION : has
    
    TENANT ||--o{ ORDER : receives
    ORDER ||--o{ ORDER_ITEM : contains
    PRODUCT_VARIANT ||--o{ ORDER_ITEM : ordered_as
    
    TENANT ||--o{ SUPPLIER : works_with
    SUPPLIER ||--o{ PURCHASE_ORDER : receives
    PURCHASE_ORDER ||--o{ PO_ITEM : contains
    
    TENANT ||--o{ CHANNEL : integrates
    CHANNEL ||--o{ CHANNEL_INVENTORY : allocates
    PRODUCT ||--o{ CHANNEL_INVENTORY : allocated_to
```

### **Key Database Tables**

#### **Products & Inventory**
```sql
-- Products table
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    name VARCHAR(255) NOT NULL,
    sku VARCHAR(100) NOT NULL,
    barcode VARCHAR(50),
    category_id UUID REFERENCES product_categories(id),
    description TEXT,
    images JSONB DEFAULT '[]',
    dimensions JSONB DEFAULT '{}',
    attributes JSONB DEFAULT '{}',
    cost_price DECIMAL(12,2),
    selling_price DECIMAL(12,2),
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, sku),
    UNIQUE(tenant_id, barcode)
);

-- Inventory items table
CREATE TABLE inventory_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    product_id UUID NOT NULL REFERENCES products(id),
    location_id UUID NOT NULL REFERENCES inventory_locations(id),
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER GENERATED ALWAYS AS (quantity_on_hand - quantity_reserved) STORED,
    reorder_point INTEGER DEFAULT 0,
    max_stock_level INTEGER,
    last_movement_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, product_id, location_id)
);

-- Inventory transactions table (audit trail)
CREATE TABLE inventory_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
    transaction_type VARCHAR(20) NOT NULL, -- 'in', 'out', 'adjustment'
    quantity_change INTEGER NOT NULL,
    quantity_before INTEGER NOT NULL,
    quantity_after INTEGER NOT NULL,
    reference_type VARCHAR(50), -- 'sale', 'purchase', 'adjustment', 'transfer'
    reference_id UUID,
    reason_code VARCHAR(50),
    notes TEXT,
    cost_per_unit DECIMAL(12,4),
    user_id UUID REFERENCES users(id),
    created_at TIMESTAMP DEFAULT NOW()
);
```

#### **Orders & Sales**
```sql
-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    external_id VARCHAR(100), -- marketplace order ID
    channel_id UUID REFERENCES channels(id),
    customer_info JSONB NOT NULL,
    order_date TIMESTAMP NOT NULL,
    status VARCHAR(20) DEFAULT 'pending',
    subtotal DECIMAL(12,2) NOT NULL,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    shipping_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'IDR',
    fulfillment_location_id UUID REFERENCES inventory_locations(id),
    shipping_info JSONB DEFAULT '{}',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(tenant_id, order_number)
);

-- Order items table
CREATE TABLE order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    order_id UUID NOT NULL REFERENCES orders(id),
    product_id UUID NOT NULL REFERENCES products(id),
    product_variant_id UUID REFERENCES product_variants(id),
    quantity INTEGER NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    total_price DECIMAL(12,2) NOT NULL,
    cost_price DECIMAL(12,2),
    created_at TIMESTAMP DEFAULT NOW()
);
```

### **Database Indexing Strategy**
```sql
-- Performance indexes for common queries
CREATE INDEX CONCURRENTLY idx_products_tenant_status ON products(tenant_id, status);
CREATE INDEX CONCURRENTLY idx_products_tenant_category ON products(tenant_id, category_id);
CREATE INDEX CONCURRENTLY idx_products_sku_search ON products USING gin(to_tsvector('english', sku || ' ' || name));

CREATE INDEX CONCURRENTLY idx_inventory_tenant_location ON inventory_items(tenant_id, location_id);
CREATE INDEX CONCURRENTLY idx_inventory_low_stock ON inventory_items(tenant_id) WHERE quantity_available <= reorder_point;

CREATE INDEX CONCURRENTLY idx_transactions_tenant_date ON inventory_transactions(tenant_id, created_at DESC);
CREATE INDEX CONCURRENTLY idx_transactions_item_type ON inventory_transactions(inventory_item_id, transaction_type);

CREATE INDEX CONCURRENTLY idx_orders_tenant_status ON orders(tenant_id, status, created_at DESC);
CREATE INDEX CONCURRENTLY idx_orders_channel_date ON orders(channel_id, order_date DESC);

-- JSON indexes for attributes and settings
CREATE INDEX CONCURRENTLY idx_products_attributes ON products USING gin(attributes);
CREATE INDEX CONCURRENTLY idx_tenant_settings ON tenants USING gin(settings);
```

---

## 🔌 API Architecture

### **RESTful API Design**

#### **URL Structure**
```
Base URL: https://api.stokcerdas.com/api/v1

Resources:
├── /auth
│   ├── POST /login
│   ├── POST /register  
│   ├── POST /refresh
│   └── POST /logout
│
├── /products
│   ├── GET /products
│   ├── POST /products
│   ├── GET /products/{id}
│   ├── PUT /products/{id}
│   ├── DELETE /products/{id}
│   ├── POST /products/bulk-import
│   └── GET /products/{id}/variants
│
├── /inventory
│   ├── GET /inventory/items
│   ├── POST /inventory/adjustments
│   ├── POST /inventory/transfers
│   ├── GET /inventory/transactions
│   └── GET /inventory/locations
│
├── /orders
│   ├── GET /orders
│   ├── POST /orders
│   ├── GET /orders/{id}
│   ├── PUT /orders/{id}/status
│   └── POST /orders/{id}/fulfill
│
├── /analytics
│   ├── GET /analytics/inventory
│   ├── GET /analytics/sales
│   ├── GET /analytics/predictions
│   └── GET /analytics/reports
│
└── /integrations
    ├── GET /integrations/channels
    ├── POST /integrations/channels/connect
    ├── POST /integrations/sync
    └── GET /integrations/webhooks
```

#### **Controller Structure Example**
```typescript
@Controller('products')
@UseGuards(JwtAuthGuard, TenantGuard)
export class ProductsController {
  constructor(private productsService: ProductsService) {}

  @Get()
  @UseInterceptors(CacheInterceptor)
  @CacheTTL(300) // 5 minutes cache
  async findAll(
    @CurrentTenant() tenantId: string,
    @Query() query: ProductQueryDto,
  ): Promise<StandardResponse<Product[]>> {
    const result = await this.productsService.findAll(tenantId, query);
    
    return {
      success: true,
      data: result.items,
      meta: {
        pagination: result.pagination,
        timestamp: new Date().toISOString(),
        requestId: generateRequestId(),
      },
    };
  }

  @Post()
  @Permissions('products:write')
  async create(
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: User,
    @Body() createProductDto: CreateProductDto,
  ): Promise<StandardResponse<Product>> {
    const product = await this.productsService.create(
      tenantId,
      createProductDto,
      user.id,
    );

    // Emit real-time event
    this.realtimeGateway.emit(`tenant:${tenantId}`, 'product.created', {
      product,
      userId: user.id,
    });

    return {
      success: true,
      data: product,
      message: 'Product created successfully',
    };
  }
}
```

### **Request/Response Middleware**

#### **Tenant Isolation Middleware**
```typescript
@Injectable()
export class TenantInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const tenantId = request.tenantId;

    // Set database context
    return from(this.setDatabaseContext(tenantId)).pipe(
      switchMap(() => next.handle()),
      catchError((error) => {
        this.clearDatabaseContext();
        throw error;
      }),
      finalize(() => {
        this.clearDatabaseContext();
      }),
    );
  }

  private async setDatabaseContext(tenantId: string): Promise<void> {
    // Set PostgreSQL session variable for RLS
    await this.dataSource.query(
      `SET app.current_tenant_id = '${tenantId}'`
    );
  }
}
```

#### **Logging Interceptor**
```typescript
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const startTime = Date.now();
    
    return next.handle().pipe(
      tap((response) => {
        const duration = Date.now() - startTime;
        
        this.logger.log({
          method: request.method,
          url: request.url,
          tenantId: request.tenantId,
          userId: request.user?.id,
          duration,
          responseSize: JSON.stringify(response).length,
        });
      }),
    );
  }
}
```

### **Data Transfer Objects (DTOs)**

#### **Validation & Transformation**
```typescript
export class CreateProductDto {
  @IsNotEmpty()
  @IsString()
  @MaxLength(255)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/^[A-Z0-9-]+$/, { message: 'SKU must contain only uppercase letters, numbers, and hyphens' })
  sku?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  barcode?: string;

  @IsUUID()
  categoryId: string;

  @IsOptional()
  @IsString()
  description?: string;

  @ValidateNested()
  @Type(() => ProductPriceDto)
  price: ProductPriceDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ProductDimensionsDto)
  dimensions?: ProductDimensionsDto;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ProductVariantDto)
  variants?: ProductVariantDto[];
}

export class ProductPriceDto {
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  cost: number;

  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  selling: number;

  @IsOptional()
  @IsString()
  @IsIn(['IDR', 'USD', 'EUR'])
  currency?: string = 'IDR';
}
```

---

## ⚡ Real-time System

### **WebSocket Gateway Implementation**
```typescript
@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/realtime',
})
export class RealtimeGateway implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private connectedClients = new Map<string, { socket: Socket; tenantId: string; userId: string }>();

  afterInit(server: Server) {
    this.logger.log('WebSocket Gateway initialized');
  }

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth.token;
      const { tenantId, userId } = await this.authService.verifyToken(token);
      
      this.connectedClients.set(client.id, { socket: client, tenantId, userId });
      
      // Join tenant-specific room
      client.join(`tenant:${tenantId}`);
      
      // Join user-specific room
      client.join(`user:${userId}`);
      
      this.logger.log(`Client connected: ${client.id} (tenant: ${tenantId}, user: ${userId})`);
      
      // Send connection confirmation
      client.emit('connected', {
        message: 'Connected to StokCerdas real-time updates',
        tenantId,
        userId,
      });
      
    } catch (error) {
      this.logger.error('WebSocket authentication failed', error);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket) {
    const clientInfo = this.connectedClients.get(client.id);
    if (clientInfo) {
      this.logger.log(`Client disconnected: ${client.id} (tenant: ${clientInfo.tenantId})`);
      this.connectedClients.delete(client.id);
    }
  }

  // Emit to all clients in a tenant
  emitToTenant(tenantId: string, event: string, data: any) {
    this.server.to(`tenant:${tenantId}`).emit(event, {
      type: event,
      payload: data,
      timestamp: new Date().toISOString(),
    });
  }

  // Emit to specific user
  emitToUser(userId: string, event: string, data: any) {
    this.server.to(`user:${userId}`).emit(event, {
      type: event,
      payload: data,
      timestamp: new Date().toISOString(),
    });
  }
}
```

### **Real-time Event System**
```typescript
// Event emitter service for real-time updates
@Injectable()
export class RealtimeEventService {
  constructor(private realtimeGateway: RealtimeGateway) {}

  // Inventory change events
  emitInventoryUpdate(tenantId: string, data: InventoryUpdateEvent) {
    this.realtimeGateway.emitToTenant(tenantId, 'inventory.updated', data);
  }

  // Order events
  emitOrderCreated(tenantId: string, order: Order) {
    this.realtimeGateway.emitToTenant(tenantId, 'order.created', {
      orderId: order.id,
      orderNumber: order.orderNumber,
      channel: order.channel?.name,
      totalAmount: order.totalAmount,
      itemCount: order.items?.length,
    });
  }

  // Alert events
  emitLowStockAlert(tenantId: string, alert: LowStockAlert) {
    this.realtimeGateway.emitToTenant(tenantId, 'alert.low_stock', {
      productId: alert.productId,
      productName: alert.productName,
      currentStock: alert.currentStock,
      reorderPoint: alert.reorderPoint,
      locationId: alert.locationId,
      severity: alert.severity,
    });
  }

  // Sync status events
  emitSyncStatus(tenantId: string, status: SyncStatusEvent) {
    this.realtimeGateway.emitToTenant(tenantId, 'sync.status', status);
  }
}

// Usage in service
@Injectable()
export class InventoryService {
  constructor(
    private realtimeEventService: RealtimeEventService,
  ) {}

  async adjustStock(tenantId: string, adjustment: StockAdjustmentDto): Promise<InventoryItem> {
    const inventoryItem = await this.applyStockAdjustment(tenantId, adjustment);
    
    // Emit real-time update
    this.realtimeEventService.emitInventoryUpdate(tenantId, {
      productId: inventoryItem.productId,
      locationId: inventoryItem.locationId,
      previousQuantity: adjustment.previousQuantity,
      newQuantity: inventoryItem.quantityOnHand,
      changeType: 'adjustment',
      reason: adjustment.reason,
      userId: adjustment.userId,
    });
    
    // Check for low stock alerts
    if (inventoryItem.quantityAvailable <= inventoryItem.reorderPoint) {
      await this.triggerLowStockAlert(tenantId, inventoryItem);
    }
    
    return inventoryItem;
  }
}
```

---

## 🔗 Integration Layer

### **Integration Architecture**
```typescript
// Base API service for all integrations
@Injectable()
export abstract class BaseApiService {
  protected readonly httpService: HttpService;
  protected readonly logger = new Logger(this.constructor.name);

  constructor(httpService: HttpService) {
    this.httpService = httpService;
  }

  protected async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    url: string,
    config: {
      headers?: Record<string, string>;
      data?: any;
      params?: Record<string, any>;
      timeout?: number;
    } = {},
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const response = await this.httpService.axiosRef.request({
        method,
        url,
        headers: config.headers,
        data: config.data,
        params: config.params,
        timeout: config.timeout || 30000,
      });

      const duration = Date.now() - startTime;
      this.logger.log(`${method} ${url} - ${response.status} (${duration}ms)`);

      return response.data;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.logger.error(`${method} ${url} - Error (${duration}ms)`, error.response?.data || error.message);
      throw error;
    }
  }

  protected generateSignature(data: string, secret: string): string {
    return crypto.createHmac('sha256', secret).update(data).digest('hex');
  }
}
```

### **Shopee Integration Implementation**
```typescript
@Injectable()
export class ShopeeApiService extends BaseApiService {
  private readonly baseUrl = 'https://partner.shopeemobile.com/api/v2';

  async getShopInfo(credentials: ShopeeCredentials): Promise<ShopeeShopInfo> {
    const timestamp = Math.floor(Date.now() / 1000);
    const path = '/shop/get_shop_info';
    
    const signature = this.generateShopeeSignature(
      credentials.partnerId,
      path,
      timestamp,
      credentials.accessToken,
      credentials.shopId,
      credentials.partnerKey,
    );

    return this.makeRequest<ShopeeShopInfo>('GET', `${this.baseUrl}${path}`, {
      headers: {
        'Authorization': credentials.accessToken,
      },
      params: {
        partner_id: credentials.partnerId,
        timestamp,
        access_token: credentials.accessToken,
        shop_id: credentials.shopId,
        sign: signature,
      },
    });
  }

  async syncProducts(tenantId: string, shopeeShopId: string): Promise<void> {
    // Get products from Shopee
    const shopeeProducts = await this.getProducts(shopeeShopId);
    
    // Sync with local database
    for (const shopeeProduct of shopeeProducts) {
      await this.productSyncService.syncProduct(tenantId, {
        externalId: shopeeProduct.item_id.toString(),
        platform: 'shopee',
        name: shopeeProduct.item_name,
        sku: shopeeProduct.item_sku,
        price: shopeeProduct.price,
        stock: shopeeProduct.stock,
        images: shopeeProduct.images,
        status: shopeeProduct.item_status,
      });
    }
  }

  private generateShopeeSignature(
    partnerId: string,
    path: string,
    timestamp: number,
    accessToken: string,
    shopId: string,
    partnerKey: string,
  ): string {
    const baseString = `${partnerId}${path}${timestamp}${accessToken}${shopId}`;
    return crypto.createHmac('sha256', partnerKey).update(baseString).digest('hex');
  }
}
```

### **Integration Sync Service**
```typescript
@Injectable()
export class IntegrationSyncService {
  constructor(
    private readonly channelSyncProcessor: ChannelSyncProcessor,
    private readonly realtimeEventService: RealtimeEventService,
  ) {}

  async syncChannel(tenantId: string, channelId: string, syncType: SyncType): Promise<SyncResult> {
    const syncJob = await this.channelSyncProcessor.add('sync-channel', {
      tenantId,
      channelId,
      syncType,
      timestamp: new Date(),
    });

    // Emit sync started event
    this.realtimeEventService.emitSyncStatus(tenantId, {
      channelId,
      status: 'started',
      syncType,
      jobId: syncJob.id,
    });

    return {
      jobId: syncJob.id,
      status: 'queued',
      estimatedDuration: this.getEstimatedDuration(syncType),
    };
  }

  async handleSyncResult(tenantId: string, result: ChannelSyncResult): Promise<void> {
    // Update sync status in database
    await this.updateSyncStatus(result);

    // Emit completion event
    this.realtimeEventService.emitSyncStatus(tenantId, {
      channelId: result.channelId,
      status: result.success ? 'completed' : 'failed',
      syncType: result.syncType,
      summary: {
        productsProcessed: result.productsProcessed,
        ordersProcessed: result.ordersProcessed,
        errors: result.errors,
        duration: result.duration,
      },
    });

    // Trigger dependent syncs if needed
    if (result.success && result.syncType === 'products') {
      await this.syncChannel(tenantId, result.channelId, 'inventory');
    }
  }
}
```

---

## 📱 Mobile Architecture

### **React Native Architecture**
```typescript
// App.tsx - Main app structure
import React from 'react';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { NavigationContainer } from '@react-navigation/native';

import { store, persistor } from './src/store';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { SocketProvider } from './src/services/socketService';

const App: React.FC = () => {
  return (
    <ErrorBoundary>
      <Provider store={store}>
        <PersistGate loading={null} persistor={persistor}>
          <SocketProvider>
            <NavigationContainer>
              <AppNavigator />
            </NavigationContainer>
          </SocketProvider>
        </PersistGate>
      </Provider>
    </ErrorBoundary>
  );
};

export default App;
```

### **State Management with Redux Toolkit**
```typescript
// store/slices/productsSlice.ts
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { productsApi } from '../api/productsApi';

interface ProductsState {
  items: Product[];
  loading: boolean;
  error: string | null;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
  filters: {
    search: string;
    category: string | null;
    status: string;
  };
}

const initialState: ProductsState = {
  items: [],
  loading: false,
  error: null,
  pagination: {
    page: 1,
    limit: 20,
    total: 0,
    pages: 0,
  },
  filters: {
    search: '',
    category: null,
    status: 'active',
  },
};

// Async thunks
export const fetchProducts = createAsyncThunk(
  'products/fetchProducts',
  async (params: { page?: number; search?: string; category?: string }) => {
    const response = await productsApi.getProducts(params);
    return response.data;
  }
);

export const createProduct = createAsyncThunk(
  'products/createProduct',
  async (productData: CreateProductDto) => {
    const response = await productsApi.createProduct(productData);
    return response.data;
  }
);

const productsSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    clearError: (state) => {
      state.error = null;
    },
    updateProductStock: (state, action) => {
      const { productId, newStock } = action.payload;
      const product = state.items.find(item => item.id === productId);
      if (product) {
        product.inventory.totalStock = newStock;
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchProducts.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchProducts.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload.products;
        state.pagination = action.payload.meta.pagination;
      })
      .addCase(fetchProducts.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || 'Failed to fetch products';
      });
  },
});

export const { setFilters, clearError, updateProductStock } = productsSlice.actions;
export default productsSlice.reducer;
```

### **API Client with RTK Query**
```typescript
// store/api/baseApi.ts
import { createApi, fetchBaseQuery } from '@reduxjs/toolkit/query/react';
import { RootState } from '../index';

export const baseApi = createApi({
  reducerPath: 'api',
  baseQuery: fetchBaseQuery({
    baseUrl: 'https://api.stokcerdas.com/api/v1',
    prepareHeaders: (headers, { getState }) => {
      const token = (getState() as RootState).auth.token;
      const tenantId = (getState() as RootState).auth.user?.tenantId;
      
      if (token) {
        headers.set('authorization', `Bearer ${token}`);
      }
      
      if (tenantId) {
        headers.set('x-tenant-id', tenantId);
      }
      
      return headers;
    },
  }),
  tagTypes: ['Product', 'Inventory', 'Order', 'Report'],
  endpoints: () => ({}),
});
```

### **Offline Support Implementation**
```typescript
// services/offlineService.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-netinfo/lib/types';

interface OfflineAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

class OfflineService {
  private readonly QUEUE_KEY = 'offline_queue';
  private queue: OfflineAction[] = [];
  private isOnline = true;

  async initialize() {
    // Load pending actions from storage
    const savedQueue = await AsyncStorage.getItem(this.QUEUE_KEY);
    if (savedQueue) {
      this.queue = JSON.parse(savedQueue);
    }

    // Listen for connectivity changes
    NetInfo.addEventListener(state => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;
      
      // Process queue when coming back online
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }
    });
  }

  async addToQueue(action: Omit<OfflineAction, 'id' | 'timestamp' | 'retryCount'>) {
    const queueItem: OfflineAction = {
      ...action,
      id: generateId(),
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.queue.push(queueItem);
    await this.saveQueue();

    // Try to process immediately if online
    if (this.isOnline) {
      this.processQueue();
    }
  }

  private async processQueue() {
    if (!this.isOnline || this.queue.length === 0) return;

    const item = this.queue[0];
    
    try {
      await this.executeAction(item);
      
      // Remove successful item from queue
      this.queue.shift();
      await this.saveQueue();
      
      // Process next item
      setTimeout(() => this.processQueue(), 1000);
      
    } catch (error) {
      console.error('Failed to process offline action:', error);
      
      item.retryCount++;
      
      // Remove item if max retries reached
      if (item.retryCount >= 3) {
        this.queue.shift();
        await this.saveQueue();
      }
      
      // Retry after delay
      setTimeout(() => this.processQueue(), 5000);
    }
  }

  private async executeAction(action: OfflineAction) {
    switch (action.type) {
      case 'STOCK_ADJUSTMENT':
        return this.api.adjustStock(action.payload);
      case 'CREATE_PRODUCT':
        return this.api.createProduct(action.payload);
      case 'UPDATE_PRODUCT':
        return this.api.updateProduct(action.payload.id, action.payload.data);
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
  }

  private async saveQueue() {
    await AsyncStorage.setItem(this.QUEUE_KEY, JSON.stringify(this.queue));
  }
}

export const offlineService = new OfflineService();
```

### **Barcode Scanner Implementation**
```typescript
// components/BarcodeScanner.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { RNCamera } from 'react-native-camera';
import { useNavigation } from '@react-navigation/native';

interface BarcodeScannerProps {
  onScanSuccess: (barcode: string) => void;
  onScanError?: (error: string) => void;
}

const BarcodeScanner: React.FC<BarcodeScannerProps> = ({
  onScanSuccess,
  onScanError,
}) => {
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isScanning, setIsScanning] = useState(true);

  useEffect(() => {
    requestCameraPermission();
  }, []);

  const requestCameraPermission = async () => {
    try {
      const result = await RNCamera.requestPermissions();
      setHasPermission(result.camera === 'authorized');
    } catch (error) {
      setHasPermission(false);
      onScanError?.('Camera permission denied');
    }
  };

  const handleBarCodeRead = (event: { data: string; type: string }) => {
    if (!isScanning) return;

    setIsScanning(false);
    
    // Validate barcode format
    if (isValidBarcode(event.data)) {
      onScanSuccess(event.data);
    } else {
      Alert.alert(
        'Invalid Barcode',
        'The scanned code is not a valid product barcode.',
        [
          { text: 'Try Again', onPress: () => setIsScanning(true) },
          { text: 'Manual Entry', onPress: () => openManualEntry() },
        ]
      );
    }
  };

  const isValidBarcode = (barcode: string): boolean => {
    // Check for common barcode formats
    const formats = [
      /^\d{13}$/, // EAN-13
      /^\d{12}$/, // UPC-A
      /^\d{8}$/,  // EAN-8
      /^[A-Z0-9\-]+$/, // Custom SKU format
    ];
    
    return formats.some(format => format.test(barcode));
  };

  if (hasPermission === null) {
    return <Text>Requesting camera permission...</Text>;
  }

  if (hasPermission === false) {
    return <Text>No access to camera</Text>;
  }

  return (
    <View style={styles.container}>
      <RNCamera
        style={styles.camera}
        onBarCodeRead={handleBarCodeRead}
        barCodeTypes={[
          RNCamera.Constants.BarCodeType.qr,
          RNCamera.Constants.BarCodeType.ean13,
          RNCamera.Constants.BarCodeType.ean8,
          RNCamera.Constants.BarCodeType.code128,
          RNCamera.Constants.BarCodeType.code39,
        ]}
        captureAudio={false}
      >
        <View style={styles.overlay}>
          <View style={styles.scanArea}>
            <Text style={styles.scanText}>
              Position barcode within the frame
            </Text>
          </View>
        </View>
      </RNCamera>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanArea: {
    width: 250,
    height: 250,
    borderWidth: 2,
    borderColor: '#00ff00',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scanText: {
    color: 'white',
    fontSize: 16,
    textAlign: 'center',
  },
});

export default BarcodeScanner;
```

---

## 🔒 Security Framework

### **Authentication & Authorization**

#### **JWT Implementation**
```typescript
// auth/jwt.strategy.ts
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    @Inject(AUTH_CONFIG) private authConfig: AuthConfig,
    private usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: authConfig.jwtSecret,
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);
    
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if token is blacklisted
    const isBlacklisted = await this.authService.isTokenBlacklisted(payload.jti);
    if (isBlacklisted) {
      throw new UnauthorizedException('Token has been revoked');
    }

    return user;
  }
}

// auth/auth.service.ts
@Injectable()
export class AuthService {
  async login(credentials: LoginDto): Promise<AuthResponse> {
    const user = await this.validateUser(credentials.email, credentials.password);
    
    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check for suspicious login patterns
    await this.checkLoginSecurity(user, credentials.userAgent, credentials.ipAddress);

    const tokens = await this.generateTokens(user);
    
    // Log successful login
    await this.auditService.logAuthEvent({
      userId: user.id,
      tenantId: user.tenantId,
      event: 'login_success',
      ipAddress: credentials.ipAddress,
      userAgent: credentials.userAgent,
    });

    return {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      expiresIn: 3600,
      user: this.sanitizeUser(user),
    };
  }

  private async generateTokens(user: User): Promise<{ accessToken: string; refreshToken: string }> {
    const jti = uuidv4(); // JWT ID for token tracking
    
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      tenantId: user.tenantId,
      roles: user.roles.map(r => r.name),
      permissions: this.getUserPermissions(user),
      jti,
    };

    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(
      { sub: user.id, jti, type: 'refresh' },
      { expiresIn: '7d' }
    );

    // Store refresh token
    await this.storeRefreshToken(user.id, refreshToken, jti);

    return { accessToken, refreshToken };
  }
}
```

#### **Permission-Based Access Control**
```typescript
// guards/permissions.guard.ts
@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      'permissions',
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    return this.hasPermissions(user, requiredPermissions);
  }

  private hasPermissions(user: User, requiredPermissions: string[]): boolean {
    const userPermissions = user.roles.flatMap(role => 
      role.permissions.map(permission => permission.name)
    );

    return requiredPermissions.every(permission => 
      userPermissions.includes(permission)
    );
  }
}

// Usage in controllers
@Controller('products')
export class ProductsController {
  @Get()
  @Permissions('products:read')
  async findAll() {
    // Implementation
  }

  @Post()
  @Permissions('products:write')
  async create() {
    // Implementation
  }

  @Delete(':id')
  @Permissions('products:delete')
  async remove() {
    // Implementation
  }
}
```

### **Data Encryption & Security**

#### **Data Encryption at Rest**
```typescript
// security/encryption.service.ts
@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;

  async encryptSensitiveData(data: string, tenantId: string): Promise<EncryptedData> {
    const key = await this.getTenantEncryptionKey(tenantId);
    const iv = crypto.randomBytes(16);
    
    const cipher = crypto.createCipher(this.algorithm, key);
    cipher.setAAD(Buffer.from(tenantId)); // Additional authenticated data
    
    let encrypted = cipher.update(data, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();

    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      algorithm: this.algorithm,
    };
  }

  async decryptSensitiveData(encryptedData: EncryptedData, tenantId: string): Promise<string> {
    const key = await this.getTenantEncryptionKey(tenantId);
    
    const decipher = crypto.createDecipher(this.algorithm, key);
    decipher.setAAD(Buffer.from(tenantId));
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  private async getTenantEncryptionKey(tenantId: string): Promise<Buffer> {
    // Derive tenant-specific key from master key
    const masterKey = process.env.MASTER_ENCRYPTION_KEY;
    return crypto.pbkdf2Sync(masterKey, tenantId, 10000, this.keyLength, 'sha256');
  }
}
```

#### **Input Validation & Sanitization**
```typescript
// validation/sanitization.pipe.ts
@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: any, metadata: ArgumentMetadata): any {
    if (metadata.type === 'body') {
      return this.sanitizeObject(value);
    }
    return value;
  }

  private sanitizeObject(obj: any): any {
    if (typeof obj !== 'object' || obj === null) {
      return this.sanitizeValue(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item));
    }

    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = this.sanitizeObject(value);
    }

    return sanitized;
  }

  private sanitizeValue(value: any): any {
    if (typeof value === 'string') {
      // Remove potential XSS payloads
      return value
        .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
        .replace(/javascript:/gi, '')
        .replace(/on\w+\s*=/gi, '')
        .trim();
    }
    return value;
  }
}
```

### **Rate Limiting & DDoS Protection**
```typescript
// guards/rate-limit.guard.ts
@Injectable()
export class RateLimitGuard implements CanActivate {
  constructor(
    @Inject('REDIS_CLIENT') private redisClient: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const key = this.getKey(request);
    const limit = this.getLimit(request);
    const window = this.getWindow(request);

    const current = await this.redisClient.incr(key);
    
    if (current === 1) {
      await this.redisClient.expire(key, window);
    }

    if (current > limit) {
      throw new ThrottlerException('Rate limit exceeded');
    }

    // Set rate limit headers
    const response = context.switchToHttp().getResponse();
    response.header('X-RateLimit-Limit', limit);
    response.header('X-RateLimit-Remaining', Math.max(0, limit - current));
    response.header('X-RateLimit-Reset', Date.now() + (window * 1000));

    return true;
  }

  private getKey(request: any): string {
    const tenantId = request.tenantId;
    const userId = request.user?.id;
    const ip = request.ip;
    const endpoint = request.route?.path;

    // Different keys for different rate limiting strategies
    if (tenantId && userId) {
      return `rate_limit:user:${tenantId}:${userId}:${endpoint}`;
    } else if (tenantId) {
      return `rate_limit:tenant:${tenantId}:${endpoint}`;
    } else {
      return `rate_limit:ip:${ip}:${endpoint}`;
    }
  }

  private getLimit(request: any): number {
    // Different limits based on user plan and endpoint
    const plan = request.user?.tenant?.plan || 'free';
    const endpoint = request.route?.path;

    const limits = {
      free: { default: 100, auth: 10, bulk: 10 },
      professional: { default: 1000, auth: 50, bulk: 100 },
      enterprise: { default: 10000, auth: 200, bulk: 1000 },
    };

    if (endpoint?.includes('/auth/')) {
      return limits[plan].auth;
    } else if (endpoint?.includes('/bulk')) {
      return limits[plan].bulk;
    } else {
      return limits[plan].default;
    }
  }
}
```

---

## ⚡ Performance & Scalability

### **Caching Strategy**

#### **Multi-Level Caching Implementation**
```typescript
// services/performance-cache.service.ts
@Injectable()
export class PerformanceCacheService {
  constructor(
    @Inject('REDIS_CLIENT') private redisClient: Redis,
    private logger: Logger,
  ) {}

  // Level 1: In-Memory Cache (Hot Data) - 30 seconds TTL
  private memoryCache = new Map<string, { data: any; expires: number }>();

  // Level 2: Redis Cache (Warm Data) - 15-30 minutes TTL
  // Level 3: Application Cache (Cold Data) - 1-24 hours TTL

  async get<T>(key: string, tenantId: string): Promise<T | null> {
    const cacheKey = this.buildKey(key, tenantId);

    // Level 1: Check in-memory cache
    const memoryResult = this.getFromMemory<T>(cacheKey);
    if (memoryResult !== null) {
      this.logger.debug(`Cache HIT (Memory): ${cacheKey}`);
      return memoryResult;
    }

    // Level 2: Check Redis cache
    try {
      const redisResult = await this.redisClient.get(cacheKey);
      if (redisResult) {
        const parsed = JSON.parse(redisResult);
        
        // Store in memory cache for next access
        this.setInMemory(cacheKey, parsed, 30);
        
        this.logger.debug(`Cache HIT (Redis): ${cacheKey}`);
        return parsed;
      }
    } catch (error) {
      this.logger.warn(`Redis cache error: ${error.message}`);
    }

    this.logger.debug(`Cache MISS: ${cacheKey}`);
    return null;
  }

  async set<T>(
    key: string, 
    value: T, 
    tenantId: string, 
    ttlSeconds: number = 900
  ): Promise<void> {
    const cacheKey = this.buildKey(key, tenantId);

    // Store in memory cache (hot data)
    this.setInMemory(cacheKey, value, Math.min(ttlSeconds, 30));

    // Store in Redis cache (warm/cold data)
    try {
      await this.redisClient.setex(cacheKey, ttlSeconds, JSON.stringify(value));
      this.logger.debug(`Cache SET: ${cacheKey} (TTL: ${ttlSeconds}s)`);
    } catch (error) {
      this.logger.warn(`Redis cache set error: ${error.message}`);
    }
  }

  async invalidate(pattern: string, tenantId: string): Promise<void> {
    const searchPattern = this.buildKey(pattern, tenantId);

    // Clear from memory cache
    for (const key of this.memoryCache.keys()) {
      if (key.includes(searchPattern)) {
        this.memoryCache.delete(key);
      }
    }

    // Clear from Redis cache
    try {
      const keys = await this.redisClient.keys(searchPattern);
      if (keys.length > 0) {
        await this.redisClient.del(...keys);
        this.logger.debug(`Cache INVALIDATED: ${keys.length} keys for pattern ${searchPattern}`);
      }
    } catch (error) {
      this.logger.warn(`Redis cache invalidation error: ${error.message}`);
    }
  }

  private buildKey(key: string, tenantId: string): string {
    return `stokcerdas:${tenantId}:${key}`;
  }

  private getFromMemory<T>(key: string): T | null {
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.data;
    }
    
    if (cached) {
      this.memoryCache.delete(key);
    }
    
    return null;
  }

  private setInMemory<T>(key: string, value: T, ttlSeconds: number): void {
    this.memoryCache.set(key, {
      data: value,
      expires: Date.now() + (ttlSeconds * 1000),
    });

    // Cleanup expired entries periodically
    this.cleanupMemoryCache();
  }

  private cleanupMemoryCache(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expires < now) {
        this.memoryCache.delete(key);
      }
    }
  }
}
```

#### **Cache Decorators**
```typescript
// decorators/cacheable.decorator.ts
export function Cacheable(options: {
  keyPrefix: string;
  ttl?: number;
  invalidateOn?: string[];
}) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const cacheService: PerformanceCacheService = this.cacheService;
      const tenantId = this.getTenantId(args);
      
      const cacheKey = `${options.keyPrefix}:${this.buildCacheKey(args)}`;
      
      // Try to get from cache
      const cached = await cacheService.get(cacheKey, tenantId);
      if (cached !== null) {
        return cached;
      }

      // Execute original method
      const result = await method.apply(this, args);
      
      // Store in cache
      await cacheService.set(cacheKey, result, tenantId, options.ttl || 900);
      
      return result;
    };

    return descriptor;
  };
}

// Usage example
@Injectable()
export class ProductsService {
  constructor(private cacheService: PerformanceCacheService) {}

  @Cacheable({
    keyPrefix: 'products:list',
    ttl: 300, // 5 minutes
    invalidateOn: ['product:created', 'product:updated', 'product:deleted']
  })
  async findAll(tenantId: string, query: ProductQueryDto): Promise<Product[]> {
    return this.productRepository.find({
      where: { tenantId, ...query.filters },
      take: query.limit,
      skip: (query.page - 1) * query.limit,
    });
  }
}
```

### **Database Optimization**

#### **Query Optimization**
```typescript
// services/products-optimized.service.ts
@Injectable()
export class ProductsOptimizedService {
  constructor(
    @InjectRepository(Product) private productRepository: Repository<Product>,
    private cacheService: PerformanceCacheService,
  ) {}

  async findWithOptimizedRelations(
    tenantId: string,
    includeInventory = false,
    includeVariants = false,
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository
      .createQueryBuilder('product')
      .where('product.tenant_id = :tenantId', { tenantId })
      .select([
        'product.id',
        'product.name',
        'product.sku',
        'product.selling_price',
        'product.status',
      ]);

    // Conditionally join relations to avoid N+1 queries
    if (includeInventory) {
      queryBuilder
        .leftJoinAndSelect('product.inventoryItems', 'inventory')
        .addSelect([
          'inventory.quantity_on_hand',
          'inventory.quantity_available',
          'inventory.reorder_point',
        ]);
    }

    if (includeVariants) {
      queryBuilder
        .leftJoinAndSelect('product.variants', 'variants')
        .addSelect([
          'variants.id',
          'variants.sku',
          'variants.attributes',
        ]);
    }

    // Use index for performance
    queryBuilder.addOrderBy('product.updated_at', 'DESC');

    return queryBuilder.getMany();
  }

  // Bulk operations for better performance
  async bulkUpdatePrices(
    tenantId: string,
    updates: { productId: string; newPrice: number }[],
  ): Promise<void> {
    await this.productRepository.manager.transaction(async manager => {
      const cases = updates
        .map(update => `WHEN id = '${update.productId}' THEN ${update.newPrice}`)
        .join(' ');
      
      const ids = updates.map(update => `'${update.productId}'`).join(',');

      await manager.query(`
        UPDATE products 
        SET selling_price = CASE ${cases} END,
            updated_at = NOW()
        WHERE tenant_id = $1 AND id IN (${ids})
      `, [tenantId]);
    });

    // Invalidate related caches
    await this.cacheService.invalidate('products:*', tenantId);
  }

  // Optimized search with full-text search
  async searchProducts(
    tenantId: string,
    searchTerm: string,
    limit = 20,
  ): Promise<Product[]> {
    return this.productRepository
      .createQueryBuilder('product')
      .where('product.tenant_id = :tenantId', { tenantId })
      .andWhere(
        `to_tsvector('english', product.name || ' ' || product.sku) 
         @@ plainto_tsquery('english', :searchTerm)`,
        { searchTerm }
      )
      .orderBy(
        `ts_rank(to_tsvector('english', product.name || ' ' || product.sku), 
                plainto_tsquery('english', :searchTerm))`,
        'DESC'
      )
      .setParameter('searchTerm', searchTerm)
      .limit(limit)
      .getMany();
  }
}
```

### **Performance Monitoring**
```typescript
// services/performance-monitoring.service.ts
@Injectable()
export class PerformanceMonitoringService {
  private metrics = new Map<string, PerformanceMetric[]>();

  constructor(
    @Inject('REDIS_CLIENT') private redisClient: Redis,
    private logger: Logger,
  ) {}

  async trackApiResponse(
    endpoint: string,
    method: string,
    duration: number,
    statusCode: number,
    tenantId: string,
  ): Promise<void> {
    const metric: ApiMetric = {
      endpoint,
      method,
      duration,
      statusCode,
      tenantId,
      timestamp: new Date(),
    };

    // Store in Redis for real-time monitoring
    await this.redisClient.lpush(
      'api_metrics',
      JSON.stringify(metric)
    );

    // Alert on slow responses
    if (duration > 2000) { // > 2 seconds
      this.logger.warn(`Slow API response: ${method} ${endpoint} - ${duration}ms`);
    }

    // Alert on error rates
    if (statusCode >= 500) {
      await this.incrementErrorCount(endpoint, tenantId);
    }
  }

  async trackDatabaseQuery(
    query: string,
    duration: number,
    tenantId: string,
  ): Promise<void> {
    // Log slow queries
    if (duration > 1000) { // > 1 second
      this.logger.warn(`Slow database query: ${duration}ms`, { query, tenantId });
    }

    const metric: DbMetric = {
      query: this.sanitizeQuery(query),
      duration,
      tenantId,
      timestamp: new Date(),
    };

    await this.redisClient.lpush(
      'db_metrics',
      JSON.stringify(metric)
    );
  }

  async trackCachePerformance(
    operation: 'hit' | 'miss' | 'set',
    key: string,
    tenantId: string,
  ): Promise<void> {
    const dailyKey = `cache_stats:${tenantId}:${this.getDateKey()}`;
    
    await this.redisClient.hincrby(dailyKey, operation, 1);
    await this.redisClient.expire(dailyKey, 86400 * 7); // Keep for 7 days
  }

  async getPerformanceReport(tenantId: string): Promise<PerformanceReport> {
    const today = this.getDateKey();
    
    // Get API metrics
    const apiMetrics = await this.getApiMetrics(tenantId, today);
    
    // Get cache stats
    const cacheStats = await this.redisClient.hgetall(`cache_stats:${tenantId}:${today}`);
    
    // Calculate cache hit ratio
    const hits = parseInt(cacheStats.hit || '0');
    const misses = parseInt(cacheStats.miss || '0');
    const hitRatio = hits + misses > 0 ? (hits / (hits + misses)) * 100 : 0;

    return {
      date: today,
      tenantId,
      api: {
        totalRequests: apiMetrics.length,
        averageResponseTime: this.calculateAverage(apiMetrics.map(m => m.duration)),
        p95ResponseTime: this.calculatePercentile(apiMetrics.map(m => m.duration), 95),
        errorRate: this.calculateErrorRate(apiMetrics),
      },
      cache: {
        hitRatio: Math.round(hitRatio * 100) / 100,
        totalHits: hits,
        totalMisses: misses,
      },
      slowQueries: await this.getSlowQueries(tenantId, today),
    };
  }

  private sanitizeQuery(query: string): string {
    // Remove sensitive data from query logging
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password='***'")
      .replace(/token\s*=\s*'[^']*'/gi, "token='***'")
      .substring(0, 500); // Limit length
  }

  private getDateKey(): string {
    return new Date().toISOString().split('T')[0];
  }
}
```

---

## 🚀 Deployment Architecture

### **Docker Configuration**

#### **Production Dockerfile**
```dockerfile
# Multi-stage build for production optimization
FROM node:18-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Install dependencies
RUN npm ci --only=production && npm cache clean --force

# Copy source code
COPY src/ ./src/

# Build application
RUN npm run build

# Production stage
FROM node:18-alpine AS production

# Install security updates
RUN apk update && apk upgrade && apk add --no-cache dumb-init

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

WORKDIR /app

# Copy built application
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# Change ownership
RUN chown -R nestjs:nodejs /app
USER nestjs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node dist/health-check.js || exit 1

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

#### **Docker Compose for Production**
```yaml
# docker-compose.prod.yml
version: '3.8'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: production
    ports:
      - "3000:3000"
    environment:
      NODE_ENV: production
      DATABASE_URL: postgres://user:pass@postgres:5432/stokcerdas
      REDIS_URL: redis://redis:6379
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy
    restart: unless-stopped
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '1.0'
          memory: 1G
        reservations:
          cpus: '0.5'
          memory: 512M

  postgres:
    image: postgres:15-alpine
    environment:
      POSTGRES_DB: stokcerdas
      POSTGRES_USER: stokcerdas
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD}
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./docker/postgres/init:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U stokcerdas"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "--raw", "incr", "ping"]
      interval: 30s
      timeout: 10s
      retries: 5
    restart: unless-stopped

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./docker/nginx/nginx.conf:/etc/nginx/nginx.conf
      - ./docker/nginx/ssl:/etc/nginx/ssl
    depends_on:
      - app
    restart: unless-stopped

volumes:
  postgres_data:
  redis_data:
```

### **Kubernetes Deployment**

#### **Application Deployment**
```yaml
# k8s/app-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: stokcerdas-app
  labels:
    app: stokcerdas
    component: backend
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0
  selector:
    matchLabels:
      app: stokcerdas
      component: backend
  template:
    metadata:
      labels:
        app: stokcerdas
        component: backend
    spec:
      containers:
      - name: app
        image: stokcerdas/backend:latest
        ports:
        - containerPort: 3000
        env:
        - name: NODE_ENV
          value: "production"
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: stokcerdas-secrets
              key: database-url
        - name: REDIS_URL
          valueFrom:
            secretKeyRef:
              name: stokcerdas-secrets
              key: redis-url
        - name: JWT_SECRET
          valueFrom:
            secretKeyRef:
              name: stokcerdas-secrets
              key: jwt-secret
        resources:
          requests:
            memory: "512Mi"
            cpu: "250m"
          limits:
            memory: "1Gi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: app-config
          mountPath: /app/config
          readOnly: true
      volumes:
      - name: app-config
        configMap:
          name: stokcerdas-config
      imagePullSecrets:
      - name: registry-secret
```

#### **Service & Ingress**
```yaml
# k8s/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: stokcerdas-service
spec:
  selector:
    app: stokcerdas
    component: backend
  ports:
  - protocol: TCP
    port: 80
    targetPort: 3000
  type: ClusterIP

---
# k8s/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: stokcerdas-ingress
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/rate-limit: "100"
    nginx.ingress.kubernetes.io/rate-limit-window: "1m"
spec:
  tls:
  - hosts:
    - api.stokcerdas.com
    secretName: stokcerdas-tls
  rules:
  - host: api.stokcerdas.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: stokcerdas-service
            port:
              number: 80
```

### **CI/CD Pipeline**

#### **GitHub Actions Workflow**
```yaml
# .github/workflows/deploy.yml
name: Deploy to Production

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_PASSWORD: postgres
          POSTGRES_DB: test_db
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
        cache: 'npm'
    
    - name: Install dependencies
      run: npm ci
    
    - name: Run linting
      run: npm run lint
    
    - name: Run tests
      run: npm run test:cov
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test_db
    
    - name: Run e2e tests
      run: npm run test:e2e
      env:
        DATABASE_URL: postgres://postgres:postgres@localhost:5432/test_db

  security-scan:
    runs-on: ubuntu-latest
    steps:
    - uses: actions/checkout@v3
    
    - name: Run security audit
      run: npm audit --audit-level high
    
    - name: Run Snyk security scan
      uses: snyk/actions/node@master
      env:
        SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}

  build-and-deploy:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Configure AWS credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
        aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
        aws-region: ap-southeast-1

    - name: Login to Amazon ECR
      id: login-ecr
      uses: aws-actions/amazon-ecr-login@v1

    - name: Build and push Docker image
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: stokcerdas-backend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
        docker tag $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG $ECR_REGISTRY/$ECR_REPOSITORY:latest
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        docker push $ECR_REGISTRY/$ECR_REPOSITORY:latest

    - name: Deploy to EKS
      env:
        ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
        ECR_REPOSITORY: stokcerdas-backend
        IMAGE_TAG: ${{ github.sha }}
      run: |
        aws eks update-kubeconfig --name stokcerdas-cluster --region ap-southeast-1
        kubectl set image deployment/stokcerdas-app app=$ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
        kubectl rollout status deployment/stokcerdas-app
```

---

## 📊 Monitoring & Observability

### **Application Monitoring**

#### **Health Check Implementation**
```typescript
// health/health.controller.ts
@Controller('health')
export class HealthController {
  constructor(
    private readonly healthService: HealthService,
    private readonly metricsService: MetricsService,
  ) {}

  @Get()
  @Public()
  async check(): Promise<HealthStatus> {
    const checks = await Promise.allSettled([
      this.healthService.checkDatabase(),
      this.healthService.checkRedis(),
      this.healthService.checkExternalAPIs(),
    ]);

    const status = checks.every(check => check.status === 'fulfilled' && check.value.status === 'ok')
      ? 'ok'
      : 'error';

    return {
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version,
      environment: process.env.NODE_ENV,
      checks: {
        database: this.getCheckResult(checks[0]),
        redis: this.getCheckResult(checks[1]),
        externalAPIs: this.getCheckResult(checks[2]),
      },
      metrics: await this.metricsService.getCurrentMetrics(),
    };
  }

  @Get('ready')
  @Public()
  async readiness(): Promise<{ status: string }> {
    // Check if application is ready to serve traffic
    const isReady = await this.healthService.isApplicationReady();
    
    return {
      status: isReady ? 'ready' : 'not_ready',
    };
  }

  @Get('live')
  @Public()
  async liveness(): Promise<{ status: string }> {
    // Simple liveness check
    return { status: 'alive' };
  }
}
```

#### **Metrics Collection**
```typescript
// metrics/metrics.service.ts
@Injectable()
export class MetricsService {
  private readonly metrics = {
    httpRequestsTotal: new prometheus.Counter({
      name: 'http_requests_total',
      help: 'Total number of HTTP requests',
      labelNames: ['method', 'route', 'status_code', 'tenant_id'],
    }),
    
    httpRequestDuration: new prometheus.Histogram({
      name: 'http_request_duration_seconds',
      help: 'HTTP request duration in seconds',
      labelNames: ['method', 'route', 'tenant_id'],
      buckets: [0.1, 0.3, 0.5, 0.7, 1, 3, 5, 7, 10],
    }),
    
    databaseQueryDuration: new prometheus.Histogram({
      name: 'database_query_duration_seconds',
      help: 'Database query duration in seconds',
      labelNames: ['operation', 'table', 'tenant_id'],
      buckets: [0.01, 0.05, 0.1, 0.3, 0.5, 1, 2, 5],
    }),
    
    cacheOperations: new prometheus.Counter({
      name: 'cache_operations_total',
      help: 'Total cache operations',
      labelNames: ['operation', 'result', 'tenant_id'],
    }),
    
    activeUsers: new prometheus.Gauge({
      name: 'active_users_total',
      help: 'Number of active users',
      labelNames: ['tenant_id'],
    }),
    
    inventoryValue: new prometheus.Gauge({
      name: 'inventory_value_total',
      help: 'Total inventory value by tenant',
      labelNames: ['tenant_id', 'currency'],
    }),
  };

  recordHttpRequest(
    method: string,
    route: string,
    statusCode: number,
    duration: number,
    tenantId: string,
  ): void {
    this.metrics.httpRequestsTotal
      .labels(method, route, statusCode.toString(), tenantId)
      .inc();
      
    this.metrics.httpRequestDuration
      .labels(method, route, tenantId)
      .observe(duration / 1000);
  }

  recordDatabaseQuery(
    operation: string,
    table: string,
    duration: number,
    tenantId: string,
  ): void {
    this.metrics.databaseQueryDuration
      .labels(operation, table, tenantId)
      .observe(duration / 1000);
  }

  recordCacheOperation(
    operation: 'hit' | 'miss' | 'set' | 'delete',
    tenantId: string,
  ): void {
    this.metrics.cacheOperations
      .labels(operation, 'success', tenantId)
      .inc();
  }

  setActiveUsers(tenantId: string, count: number): void {
    this.metrics.activeUsers.labels(tenantId).set(count);
  }

  setInventoryValue(tenantId: string, value: number, currency = 'IDR'): void {
    this.metrics.inventoryValue.labels(tenantId, currency).set(value);
  }

  async getMetrics(): Promise<string> {
    return prometheus.register.metrics();
  }
}
```

### **Distributed Tracing**

#### **Jaeger Integration**
```typescript
// tracing/tracing.service.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { JaegerExporter } from '@opentelemetry/exporter-jaeger';

@Injectable()
export class TracingService {
  private sdk: NodeSDK;

  constructor() {
    const jaegerExporter = new JaegerExporter({
      endpoint: process.env.JAEGER_ENDPOINT || 'http://localhost:14268/api/traces',
    });

    this.sdk = new NodeSDK({
      traceExporter: jaegerExporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          '@opentelemetry/instrumentation-redis': {
            enabled: true,
          },
          '@opentelemetry/instrumentation-http': {
            enabled: true,
            requestHook: (span, request) => {
              span.setAttributes({
                'http.tenant_id': request.headers['x-tenant-id'],
                'http.user_id': request.headers['x-user-id'],
              });
            },
          },
          '@opentelemetry/instrumentation-postgresql': {
            enabled: true,
          },
        }),
      ],
    });
  }

  start(): void {
    this.sdk.start();
    console.log('Tracing initialized');
  }

  async shutdown(): Promise<void> {
    await this.sdk.shutdown();
  }
}

// Custom span decorator
export function Traced(operationName?: string) {
  return function (target: any, propertyName: string, descriptor: PropertyDescriptor) {
    const method = descriptor.value;

    descriptor.value = async function (...args: any[]) {
      const tracer = trace.getTracer('stokcerdas');
      const spanName = operationName || `${target.constructor.name}.${propertyName}`;
      
      return tracer.startActiveSpan(spanName, async (span) => {
        try {
          // Add custom attributes
          span.setAttributes({
            'service.name': 'stokcerdas-backend',
            'operation.name': spanName,
            'tenant.id': this.getTenantId?.(args) || 'unknown',
          });

          const result = await method.apply(this, args);
          
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        } catch (error) {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          throw error;
        } finally {
          span.end();
        }
      });
    };

    return descriptor;
  };
}
```

### **Logging Strategy**

#### **Structured Logging**
```typescript
// logging/logger.service.ts
@Injectable()
export class LoggerService implements LoggerService {
  private logger: winston.Logger;

  constructor() {
    this.logger = winston.createLogger({
      level: process.env.LOG_LEVEL || 'info',
      format: winston.format.combine(
        winston.format.timestamp(),
        winston.format.errors({ stack: true }),
        winston.format.json(),
        winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
          return JSON.stringify({
            timestamp,
            level,
            message,
            stack,
            ...meta,
            service: 'stokcerdas-backend',
            version: process.env.npm_package_version,
          });
        })
      ),
      transports: [
        new winston.transports.Console(),
        new winston.transports.File({
          filename: 'logs/error.log',
          level: 'error',
        }),
        new winston.transports.File({
          filename: 'logs/combined.log',
        }),
      ],
    });

    // Add Elasticsearch transport for production
    if (process.env.NODE_ENV === 'production') {
      this.logger.add(
        new ElasticsearchTransport({
          level: 'info',
          clientOpts: {
            node: process.env.ELASTICSEARCH_URL,
          },
          index: 'stokcerdas-logs',
        })
      );
    }
  }

  log(message: string, context?: LogContext): void {
    this.logger.info(message, this.enrichContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.logger.error(message, {
      ...this.enrichContext(context),
      error: error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : undefined,
    });
  }

  warn(message: string, context?: LogContext): void {
    this.logger.warn(message, this.enrichContext(context));
  }

  debug(message: string, context?: LogContext): void {
    this.logger.debug(message, this.enrichContext(context));
  }

  private enrichContext(context?: LogContext): object {
    return {
      ...context,
      nodeEnv: process.env.NODE_ENV,
      requestId: context?.requestId || this.getRequestId(),
      tenantId: context?.tenantId,
      userId: context?.userId,
      timestamp: new Date().toISOString(),
    };
  }

  private getRequestId(): string {
    // Get request ID from async local storage or generate new one
    return cls.getStore()?.requestId || `req_${Date.now()}_${Math.random().toString(36)}`;
  }
}
```

---

**🏗️ StokCerdas represents a comprehensive, enterprise-grade inventory intelligence platform built with modern technologies and best practices, specifically optimized for the Indonesian SMB market. The architecture ensures scalability, security, and performance while maintaining developer productivity and operational excellence.**

*Architecture documentation last updated: July 2025*