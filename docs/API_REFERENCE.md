# 🔌 StokCerdas API Reference

**RESTful API Documentation for Developers**

---

## 📋 Table of Contents

1. [API Overview](#api-overview)
2. [Authentication](#authentication)
3. [Core Modules](#core-modules)
4. [Integration APIs](#integration-apis)
5. [Real-time WebSocket](#real-time-websocket)
6. [Error Handling](#error-handling)
7. [Rate Limiting](#rate-limiting)
8. [SDK & Libraries](#sdk--libraries)

---

## 🌟 API Overview

### **Base Information**
- **Base URL**: `https://api.stokcerdas.com/api/v1`
- **Protocol**: HTTPS only
- **Format**: JSON
- **Versioning**: URL-based (`/api/v1/`, `/api/v2/`)
- **Documentation**: Interactive Swagger at `/api/docs`

### **API Design Principles**
- **RESTful**: Standard HTTP methods and status codes
- **Consistent**: Standardized response format
- **Secure**: JWT authentication with RBAC
- **Multi-tenant**: Tenant isolation at API level
- **Real-time**: WebSocket support for live updates

### **Standard Response Format**
```json
{
  "success": true,
  "data": {
    // Response payload
  },
  "meta": {
    "timestamp": "2025-07-04T10:30:00.000Z",
    "requestId": "req_123456789",
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  },
  "message": "Operation completed successfully"
}
```

### **Error Response Format**
```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid input parameters",
    "details": {
      "field": "email",
      "message": "Email format is invalid"
    }
  },
  "meta": {
    "timestamp": "2025-07-04T10:30:00.000Z",
    "requestId": "req_123456789"
  }
}
```

---

## 🔐 Authentication

### **Authentication Flow**

#### **1. User Registration**
```http
POST /api/v1/auth/register
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "securePassword123",
  "firstName": "John",
  "lastName": "Doe",
  "companyName": "PT Example Company",
  "phoneNumber": "+6281234567890"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "usr_123456789",
      "email": "user@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "status": "pending_verification"
    },
    "company": {
      "id": "cmp_123456789",
      "name": "PT Example Company",
      "tenantId": "tenant_abc123"
    }
  },
  "message": "Registration successful. Please verify your email."
}
```

#### **2. User Login**
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@company.com",
  "password": "securePassword123"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresIn": 3600,
    "user": {
      "id": "usr_123456789",
      "email": "user@company.com",
      "firstName": "John",
      "lastName": "Doe",
      "roles": ["manager"],
      "permissions": ["products:read", "inventory:write"]
    },
    "tenant": {
      "id": "tenant_abc123",
      "companyName": "PT Example Company",
      "plan": "professional"
    }
  }
}
```

#### **3. Token Refresh**
```http
POST /api/v1/auth/refresh
Content-Type: application/json
Authorization: Bearer {refreshToken}

{
  "refreshToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

### **Authorization Headers**
All authenticated requests must include:
```http
Authorization: Bearer {accessToken}
X-Tenant-ID: {tenantId}
```

### **Permission System**
```json
{
  "permissions": {
    "products": ["read", "write", "delete"],
    "inventory": ["read", "write", "adjust"],
    "orders": ["read", "write", "fulfill"],
    "reports": ["read", "export"],
    "integrations": ["read", "write", "configure"],
    "users": ["read", "write", "manage"],
    "settings": ["read", "write"]
  }
}
```

---

## 📦 Core Modules

### **1. Products API**

#### **List Products**
```http
GET /api/v1/products?page=1&limit=20&search=kaos&category=fashion
Authorization: Bearer {accessToken}
```

**Query Parameters:**
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 20, max: 100)
- `search`: Search term (name, SKU, barcode)
- `category`: Category ID filter
- `status`: active, inactive, discontinued
- `sortBy`: name, created_at, updated_at, price
- `sortOrder`: asc, desc

**Response:**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": "prd_123456789",
        "name": "Kaos Polos Cotton",
        "sku": "KPC-001",
        "barcode": "1234567890123",
        "category": {
          "id": "cat_fashion",
          "name": "Fashion"
        },
        "price": {
          "cost": 25000,
          "selling": 50000,
          "currency": "IDR"
        },
        "dimensions": {
          "weight": 200,
          "length": 30,
          "width": 25,
          "height": 1
        },
        "images": [
          "https://cdn.stokcerdas.com/products/prd_123/image1.jpg"
        ],
        "variants": [
          {
            "id": "var_size_s",
            "attribute": "size",
            "value": "S",
            "sku": "KPC-001-S"
          }
        ],
        "inventory": {
          "totalStock": 150,
          "availableStock": 120,
          "reservedStock": 30,
          "reorderPoint": 50
        },
        "status": "active",
        "createdAt": "2025-01-01T00:00:00.000Z",
        "updatedAt": "2025-07-04T10:30:00.000Z"
      }
    ]
  },
  "meta": {
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "pages": 8
    }
  }
}
```

#### **Create Product**
```http
POST /api/v1/products
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "name": "Kaos Polo Premium",
  "sku": "KPP-001",
  "barcode": "1234567890124",
  "categoryId": "cat_fashion",
  "description": "Kaos polo premium quality cotton",
  "price": {
    "cost": 45000,
    "selling": 85000
  },
  "dimensions": {
    "weight": 250,
    "length": 32,
    "width": 28,
    "height": 1
  },
  "variants": [
    {
      "attribute": "size",
      "values": ["S", "M", "L", "XL"]
    },
    {
      "attribute": "color", 
      "values": ["Red", "Blue", "White"]
    }
  ],
  "initialStock": {
    "locationId": "loc_main_warehouse",
    "quantity": 100
  },
  "reorderPoint": 25,
  "tags": ["premium", "cotton", "polo"]
}
```

#### **Update Product**
```http
PUT /api/v1/products/{productId}
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "name": "Kaos Polo Premium Updated",
  "price": {
    "selling": 90000
  },
  "reorderPoint": 30
}
```

#### **Bulk Import Products**
```http
POST /api/v1/products/bulk-import
Content-Type: multipart/form-data
Authorization: Bearer {accessToken}

file: products.xlsx
mapping: {
  "name": "A",
  "sku": "B", 
  "price.cost": "C",
  "price.selling": "D"
}
```

### **2. Inventory API**

#### **Get Inventory Items**
```http
GET /api/v1/inventory/items?locationId=loc_main&lowStock=true
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "inv_123456789",
        "product": {
          "id": "prd_123456789",
          "name": "Kaos Polos Cotton",
          "sku": "KPC-001"
        },
        "location": {
          "id": "loc_main_warehouse",
          "name": "Gudang Utama",
          "type": "warehouse"
        },
        "quantities": {
          "onHand": 45,
          "available": 35,
          "reserved": 10,
          "inTransit": 50
        },
        "reorderPoint": 50,
        "lastMovement": {
          "date": "2025-07-03T15:30:00.000Z",
          "type": "sale",
          "quantity": -5,
          "reference": "ord_987654321"
        },
        "status": "low_stock",
        "value": {
          "total": 1125000,
          "perUnit": 25000,
          "currency": "IDR"
        }
      }
    ]
  }
}
```

#### **Stock Adjustment**
```http
POST /api/v1/inventory/adjustments
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "productId": "prd_123456789",
  "locationId": "loc_main_warehouse",
  "adjustmentType": "increase",
  "quantity": 20,
  "reasonCode": "stock_found",
  "notes": "Found missing stock during cycle count",
  "costPerUnit": 25000
}
```

#### **Transfer Between Locations**
```http
POST /api/v1/inventory/transfers
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "productId": "prd_123456789",
  "fromLocationId": "loc_main_warehouse",
  "toLocationId": "loc_jakarta_branch",
  "quantity": 25,
  "transferType": "immediate",
  "notes": "Stock rebalancing",
  "shippingInfo": {
    "carrier": "JNE",
    "trackingNumber": "JNE123456789",
    "estimatedDelivery": "2025-07-06"
  }
}
```

### **3. Orders API**

#### **List Orders**
```http
GET /api/v1/orders?status=pending&channel=shopee&limit=50
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "orders": [
      {
        "id": "ord_123456789",
        "orderNumber": "SO-2025-001",
        "externalId": "shopee_order_123",
        "channel": {
          "id": "ch_shopee",
          "name": "Shopee",
          "type": "marketplace"
        },
        "customer": {
          "name": "John Customer",
          "email": "customer@email.com",
          "phone": "+6281234567890",
          "address": {
            "street": "Jl. Sudirman No. 123",
            "city": "Jakarta",
            "province": "DKI Jakarta",
            "postalCode": "12345"
          }
        },
        "items": [
          {
            "product": {
              "id": "prd_123456789",
              "name": "Kaos Polos Cotton",
              "sku": "KPC-001-M"
            },
            "quantity": 2,
            "unitPrice": 50000,
            "totalPrice": 100000
          }
        ],
        "totals": {
          "subtotal": 100000,
          "shipping": 15000,
          "tax": 11000,
          "total": 126000,
          "currency": "IDR"
        },
        "fulfillment": {
          "locationId": "loc_main_warehouse",
          "status": "pending",
          "shippingMethod": "JNE REG",
          "trackingNumber": null
        },
        "status": "pending",
        "createdAt": "2025-07-04T08:30:00.000Z"
      }
    ]
  }
}
```

#### **Fulfill Order**
```http
POST /api/v1/orders/{orderId}/fulfill
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "locationId": "loc_main_warehouse",
  "shippingMethod": "JNE REG",
  "items": [
    {
      "productId": "prd_123456789",
      "quantity": 2
    }
  ],
  "shippingInfo": {
    "carrier": "JNE",
    "service": "REG",
    "trackingNumber": "JNE123456789",
    "weight": 500,
    "cost": 15000
  }
}
```

### **4. Analytics & Reports API**

#### **Inventory Report**
```http
GET /api/v1/reports/inventory?type=valuation&locationId=loc_main
Authorization: Bearer {accessToken}
```

#### **Sales Analytics**
```http
GET /api/v1/analytics/sales?period=30d&groupBy=day&channel=all
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalRevenue": 125000000,
      "totalOrders": 2500,
      "averageOrderValue": 50000,
      "growth": {
        "revenue": 15.3,
        "orders": 8.7
      }
    },
    "timeSeries": [
      {
        "date": "2025-07-01",
        "revenue": 4200000,
        "orders": 84,
        "units": 168
      }
    ],
    "topProducts": [
      {
        "productId": "prd_123456789",
        "name": "Kaos Polos Cotton",
        "revenue": 12500000,
        "units": 250,
        "growth": 22.5
      }
    ],
    "channelBreakdown": [
      {
        "channel": "shopee",
        "revenue": 56250000,
        "percentage": 45.0
      }
    ]
  }
}
```

#### **Predictive Analytics**
```http
GET /api/v1/analytics/predictions?productId=prd_123&horizon=30d
Authorization: Bearer {accessToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "product": {
      "id": "prd_123456789",
      "name": "Kaos Polos Cotton"
    },
    "forecast": {
      "horizon": "30d",
      "confidence": 87.3,
      "model": "ensemble",
      "predictions": [
        {
          "date": "2025-07-05",
          "demandForecast": 12,
          "confidenceInterval": {
            "lower": 8,
            "upper": 16
          }
        }
      ],
      "summary": {
        "totalDemand": 350,
        "averageDaily": 11.7,
        "seasonalFactor": 1.15,
        "trendDirection": "increasing"
      }
    },
    "recommendations": {
      "reorderSuggestion": {
        "quantity": 200,
        "timing": "2025-07-10",
        "reason": "Predicted stockout on 2025-07-15"
      },
      "priceOptimization": {
        "suggestedPrice": 52000,
        "expectedImpact": "+8% revenue"
      }
    }
  }
}
```

---

## 🔗 Integration APIs

### **1. Channel Management**

#### **List Channels**
```http
GET /api/v1/channels
Authorization: Bearer {accessToken}
```

#### **Connect New Channel**
```http
POST /api/v1/channels/connect
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "platform": "shopee",
  "credentials": {
    "shopId": "123456",
    "accessToken": "shopee_access_token",
    "refreshToken": "shopee_refresh_token"
  },
  "settings": {
    "autoSync": true,
    "syncInterval": "15m",
    "allocationMethod": "percentage",
    "allocationPercentage": 40
  }
}
```

#### **Sync Channel Data**
```http
POST /api/v1/channels/{channelId}/sync
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "syncType": "full", // "full", "products", "orders", "inventory"
  "force": false
}
```

### **2. Webhook Management**

#### **Register Webhook**
```http
POST /api/v1/webhooks
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "url": "https://your-app.com/webhooks/stokcerdas",
  "events": [
    "inventory.updated",
    "order.created",
    "product.created",
    "stock.low"
  ],
  "secret": "your_webhook_secret",
  "active": true
}
```

#### **Webhook Payload Example**
```json
{
  "id": "evt_123456789",
  "type": "inventory.updated",
  "timestamp": "2025-07-04T10:30:00.000Z",
  "data": {
    "productId": "prd_123456789",
    "locationId": "loc_main_warehouse",
    "previousQuantity": 50,
    "newQuantity": 45,
    "changeType": "sale",
    "orderId": "ord_987654321"
  },
  "tenant": {
    "id": "tenant_abc123"
  }
}
```

### **3. Automation API**

#### **Create Automation Rule**
```http
POST /api/v1/automation/rules
Content-Type: application/json
Authorization: Bearer {accessToken}

{
  "name": "Auto Reorder Fast Moving Items",
  "description": "Automatically create purchase orders for fast moving items",
  "trigger": {
    "type": "stock_level",
    "conditions": [
      {
        "field": "availableStock",
        "operator": "lte",
        "value": "reorderPoint"
      },
      {
        "field": "category",
        "operator": "in",
        "value": ["fast_moving"]
      }
    ]
  },
  "actions": [
    {
      "type": "create_purchase_order",
      "parameters": {
        "quantity": "eoq",
        "supplierId": "auto_select",
        "approvalRequired": true
      }
    },
    {
      "type": "send_notification",
      "parameters": {
        "recipients": ["manager@company.com"],
        "template": "auto_reorder_created"
      }
    }
  ],
  "active": true
}
```

---

## 🔌 Real-time WebSocket

### **Connection**
```javascript
// Connect to WebSocket
const socket = new WebSocket('wss://api.stokcerdas.com/realtime');

// Authentication after connection
socket.onopen = () => {
  socket.send(JSON.stringify({
    type: 'auth',
    token: 'your_jwt_token',
    tenantId: 'tenant_abc123'
  }));
};

// Join specific rooms
socket.send(JSON.stringify({
  type: 'join_room',
  room: 'inventory_updates'
}));
```

### **Event Types**
```javascript
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  
  switch(data.type) {
    case 'inventory.updated':
      // Handle inventory changes
      console.log('Stock updated:', data.payload);
      break;
      
    case 'order.created':
      // Handle new orders
      console.log('New order:', data.payload);
      break;
      
    case 'alert.triggered':
      // Handle system alerts
      console.log('Alert:', data.payload);
      break;
      
    case 'sync.completed':
      // Handle sync completion
      console.log('Sync completed:', data.payload);
      break;
  }
};
```

### **Available Rooms**
- `inventory_updates`: Stock level changes
- `order_notifications`: New orders and status updates
- `system_alerts`: System-wide notifications
- `sync_status`: Integration sync updates
- `user_activity`: User activity in the system

---

## ⚠️ Error Handling

### **HTTP Status Codes**
- `200`: Success
- `201`: Created
- `400`: Bad Request
- `401`: Unauthorized
- `403`: Forbidden
- `404`: Not Found
- `409`: Conflict
- `422`: Validation Error
- `429`: Rate Limited
- `500`: Internal Server Error

### **Error Codes**
```javascript
{
  "VALIDATION_ERROR": "Invalid input parameters",
  "UNAUTHORIZED": "Invalid or expired token",
  "FORBIDDEN": "Insufficient permissions",
  "NOT_FOUND": "Resource not found",
  "DUPLICATE_ENTRY": "Resource already exists",
  "RATE_LIMITED": "Too many requests",
  "SYNC_ERROR": "Integration sync failed",
  "INSUFFICIENT_STOCK": "Not enough inventory",
  "TENANT_LIMIT_EXCEEDED": "Plan limits exceeded"
}
```

### **Error Handling Best Practices**
```javascript
// Example error handling in JavaScript
async function createProduct(productData) {
  try {
    const response = await fetch('/api/v1/products', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productData)
    });
    
    const result = await response.json();
    
    if (!result.success) {
      switch(result.error.code) {
        case 'VALIDATION_ERROR':
          // Handle validation errors
          showValidationErrors(result.error.details);
          break;
        case 'DUPLICATE_ENTRY':
          // Handle duplicate SKU
          showError('Product with this SKU already exists');
          break;
        default:
          showError(result.error.message);
      }
      return;
    }
    
    return result.data;
  } catch (error) {
    console.error('API Error:', error);
    showError('Network error occurred');
  }
}
```

---

## 🚦 Rate Limiting

### **Rate Limits**
- **Authentication**: 10 requests/minute
- **Standard endpoints**: 1000 requests/hour
- **Bulk operations**: 100 requests/hour
- **Analytics**: 500 requests/hour
- **WebSocket connections**: 10 concurrent/tenant

### **Rate Limit Headers**
```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1625097600
X-RateLimit-Window: 3600
```

### **Rate Limit Exceeded Response**
```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMITED",
    "message": "Rate limit exceeded",
    "details": {
      "limit": 1000,
      "remaining": 0,
      "resetTime": "2025-07-04T11:00:00.000Z"
    }
  }
}
```

---

## 📚 SDK & Libraries

### **Official SDKs**

#### **JavaScript/Node.js**
```bash
npm install @stokcerdas/sdk
```

```javascript
import { StokCerdas } from '@stokcerdas/sdk';

const client = new StokCerdas({
  apiKey: 'your_api_key',
  tenantId: 'tenant_abc123',
  baseURL: 'https://api.stokcerdas.com',
  version: 'v1'
});

// Use the SDK
const products = await client.products.list({
  page: 1,
  limit: 20,
  category: 'fashion'
});
```

#### **PHP**
```bash
composer require stokcerdas/php-sdk
```

```php
<?php
use StokCerdas\Client;

$client = new Client([
    'api_key' => 'your_api_key',
    'tenant_id' => 'tenant_abc123',
    'base_url' => 'https://api.stokcerdas.com'
]);

$products = $client->products()->list([
    'page' => 1,
    'limit' => 20
]);
?>
```

#### **Python**
```bash
pip install stokcerdas-sdk
```

```python
from stokcerdas import StokCerdas

client = StokCerdas(
    api_key="your_api_key",
    tenant_id="tenant_abc123",
    base_url="https://api.stokcerdas.com"
)

products = client.products.list(page=1, limit=20)
```

### **Community Libraries**
- **React Hooks**: `@stokcerdas/react-hooks`
- **Vue Composables**: `@stokcerdas/vue-composables`
- **Laravel Package**: `stokcerdas/laravel`
- **WordPress Plugin**: `stokcerdas-wp`

### **API Testing Tools**

#### **Postman Collection**
Import the official Postman collection:
```
https://api.stokcerdas.com/docs/postman-collection.json
```

#### **OpenAPI Spec**
Download OpenAPI 3.0 specification:
```
https://api.stokcerdas.com/docs/openapi.json
```

#### **Insomnia Collection**
Import Insomnia workspace:
```
https://api.stokcerdas.com/docs/insomnia-collection.json
```

---

## 🔧 Development Tools

### **API Explorer**
Interactive API explorer available at:
```
https://api.stokcerdas.com/api/docs
```

### **API Testing Environment**
```bash
# Sandbox Environment
BASE_URL=https://sandbox-api.stokcerdas.com
API_KEY=test_sk_...

# Test Data Reset (sandbox only)
POST /api/v1/dev/reset-data
Authorization: Bearer {test_token}
```

### **Webhooks Testing**
Use ngrok for local webhook testing:
```bash
# Install ngrok
npm install -g ngrok

# Expose local server
ngrok http 3000

# Use the ngrok URL for webhook endpoint
https://abc123.ngrok.io/webhooks/stokcerdas
```

---

## 📞 API Support

### **Developer Resources**
- **Documentation**: https://docs.stokcerdas.com/api
- **Status Page**: https://status.stokcerdas.com
- **GitHub**: https://github.com/stokcerdas/api-examples
- **Discord**: https://discord.gg/stokcerdas-dev

### **Support Channels**
- **Technical Support**: dev-support@stokcerdas.com
- **API Issues**: api-issues@stokcerdas.com
- **Feature Requests**: features@stokcerdas.com
- **Security**: security@stokcerdas.com

### **SLA**
- **Uptime**: 99.9%
- **Response Time**: <200ms (P95)
- **Support Response**: <4 hours (business hours)

---

**🚀 Happy building with StokCerdas API! 🇮🇩**

*Documentation last updated: July 2025*