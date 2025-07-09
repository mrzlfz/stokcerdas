# Event-Driven Architecture Implementation

## Overview

This implementation provides a comprehensive event-driven architecture for StokCerdas with RabbitMQ message broker integration and Indonesian business context support.

## Key Components

### 1. Message Broker Service (`MessageBrokerService`)

The `MessageBrokerService` provides low-level RabbitMQ integration with:
- Connection management and reconnection handling
- Multiple exchange types (direct, topic, fanout)
- Queue management with dead letter queues
- Indonesian business context integration
- Comprehensive error handling and retry logic

### 2. Event Bus Service (`EventBusService`)

The `EventBusService` provides high-level event publishing and subscription with:
- Local event handling (EventEmitter2)
- Distributed event handling (RabbitMQ)
- Event batching for performance
- Retry mechanisms with exponential backoff
- Indonesian business context enrichment
- Comprehensive event processing statistics

### 3. Event Infrastructure

#### Base Event Classes
- `BaseEvent`: Abstract base class for all events
- Domain-specific events: `InventoryEvents`, `OrderEvents`, `CustomerEvents`, `AnalyticsEvents`

#### Event Types
- Inventory events: stock changes, transfers, alerts
- Order events: lifecycle, payments, fulfillment
- Customer events: registration, interactions, analytics
- Analytics events: dashboards, reports, insights

## Usage Examples

### 1. Publishing Events

```typescript
import { EventBusService } from '@common/services/event-bus.service';
import { StockLevelChangedEvent } from '@common/events';

@Injectable()
export class InventoryService {
  constructor(private eventBus: EventBusService) {}

  async updateStock(productId: string, newStock: number) {
    // Your business logic here
    
    // Publish event
    const event = new StockLevelChangedEvent(
      {
        tenantId: 'tenant-123',
        userId: 'user-456',
        correlationId: 'correlation-789',
      },
      productData,
      locationData,
      stockMovement,
      stockLevel,
    );

    await this.eventBus.publishInventoryEvent(
      'inventory.stock.level.changed',
      event,
      { priority: 8 }
    );
  }
}
```

### 2. Subscribing to Events

```typescript
import { EventBusService } from '@common/services/event-bus.service';
import { EventHandler } from '@common/events/base.event';
import { StockLevelChangedEvent } from '@common/events';

@Injectable()
export class NotificationService implements OnModuleInit {
  constructor(private eventBus: EventBusService) {}

  onModuleInit() {
    this.eventBus.subscribe(
      'inventory.stock.level.changed',
      new StockLevelChangedHandler(),
      {
        local: true,
        distributed: true,
        priority: 8,
      }
    );
  }
}

class StockLevelChangedHandler implements EventHandler<StockLevelChangedEvent> {
  async handle(event: StockLevelChangedEvent): Promise<void> {
    // Handle the event
    console.log(`Stock changed for product ${event.productData.id}`);
    
    // Send notifications, update caches, etc.
  }
}
```

### 3. Direct Message Broker Usage

```typescript
import { MessageBrokerService } from '@common/services/message-broker.service';

@Injectable()
export class SomeService {
  constructor(private messageBroker: MessageBrokerService) {}

  async sendMessage() {
    await this.messageBroker.publishMessage(
      {
        exchange: 'stokcerdas.inventory.events',
        routingKey: 'inventory.stock.update',
        messageType: 'stock_update',
        priority: 8,
        persistent: true,
      },
      {
        productId: 'PROD-001',
        newStock: 100,
        locationId: 'LOC-001',
      },
      {
        indonesianContext: {
          timezone: 'Asia/Jakarta',
          businessHours: true,
          ramadanSeason: false,
          regionalContext: 'indonesia',
        },
      }
    );
  }
}
```

## Configuration

### Environment Variables

```env
# RabbitMQ Configuration
RABBITMQ_HOST=localhost
RABBITMQ_PORT=5672
RABBITMQ_USERNAME=stokcerdas
RABBITMQ_PASSWORD=stokcerdas_queue
RABBITMQ_VHOST=stokcerdas_vhost

# Event Bus Configuration
EVENT_BUS_LOCAL_ENABLED=true
EVENT_BUS_DISTRIBUTED_ENABLED=true
EVENT_BUS_DEFAULT_TTL=1800000
EVENT_BUS_DEFAULT_PRIORITY=5
EVENT_BUS_MAX_RETRIES=3
EVENT_BUS_RETRY_DELAY=5000
EVENT_BUS_BATCH_SIZE=100
EVENT_BUS_FLUSH_INTERVAL=5000
```

### RabbitMQ Setup

The system automatically creates the following exchanges and queues:

#### Exchanges
- `stokcerdas.inventory.events` (topic)
- `stokcerdas.orders.events` (topic)
- `stokcerdas.customers.events` (topic)
- `stokcerdas.analytics.events` (topic)
- `stokcerdas.indonesian.business.events` (topic)
- `stokcerdas.notifications.direct` (direct)
- `stokcerdas.broadcast.fanout` (fanout)
- `stokcerdas.dlx` (direct) - Dead Letter Exchange

#### Queues
- `stokcerdas.inventory.stock.updates`
- `stokcerdas.orders.processing`
- `stokcerdas.customers.insights`
- `stokcerdas.analytics.realtime`
- `stokcerdas.indonesian.business.rules`
- `stokcerdas.integration.sync`
- `stokcerdas.notifications.high.priority`
- `stokcerdas.ml.forecasting`

## Indonesian Business Context

The system automatically enriches events with Indonesian business context:

```typescript
{
  timezone: 'Asia/Jakarta',
  businessHours: true, // 9 AM - 5 PM Jakarta time, Monday-Friday
  ramadanSeason: false, // Automatically detected
  regionalContext: 'indonesia',
  culturalFactors: {
    seasonalFactor: 1.2, // Monthly multipliers
  },
  geographicContext: {
    timeZone: 'WIB', // Western Indonesia Time
  },
}
```

## Monitoring and Statistics

### Event Bus Statistics

```typescript
const stats = this.eventBus.getSubscriptionStats();
console.log('Total subscriptions:', stats.totalSubscriptions);
console.log('Subscriptions by type:', stats.subscriptionsByType);

const batchStats = this.eventBus.getEventBatchStats();
console.log('Batch processing stats:', batchStats);
```

### Message Broker Status

```typescript
const status = this.messageBroker.getConnectionStatus();
console.log('Connection status:', status.isConnected);
console.log('Reconnect attempts:', status.reconnectAttempts);

const handlerStats = this.messageBroker.getMessageHandlerStats();
console.log('Total handlers:', handlerStats.totalHandlers);
```

## Error Handling and Reliability

### Retry Logic
- Exponential backoff for failed event processing
- Maximum retry attempts configurable
- Dead letter queue for failed messages

### Circuit Breaker Pattern
- Automatic connection recovery
- Graceful degradation during outages
- Health check endpoints

### Monitoring
- Comprehensive logging at all levels
- Performance metrics collection
- Error tracking and alerting

## Best Practices

### 1. Event Design
- Use specific event types for different business scenarios
- Include all necessary context in events
- Make events immutable and serializable

### 2. Error Handling
- Always handle errors in event handlers
- Use correlation IDs for tracing
- Implement idempotency for event processing

### 3. Performance
- Use batching for high-volume events
- Configure appropriate TTL values
- Monitor queue depths and processing times

### 4. Testing
- Use the example service for testing
- Mock event handlers for unit tests
- Test both local and distributed event flows

## Example Service

See `src/common/examples/event-driven-example.service.ts` for comprehensive usage examples including:
- Publishing different types of events
- Setting up event handlers
- Using Indonesian business context
- Direct message broker usage
- Getting statistics and monitoring data

This implementation provides a solid foundation for building scalable, event-driven applications with Indonesian business context integration.