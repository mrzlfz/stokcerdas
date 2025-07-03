# 🚀 StokCerdas Local Development Guide

**AI-Powered Inventory Intelligence Platform for Indonesian SMBs**

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Port Management](#port-management)
4. [Step-by-Step Setup](#step-by-step-setup)
5. [Services Overview](#services-overview)
6. [Testing & Verification](#testing--verification)
7. [Mobile App Setup](#mobile-app-setup)
8. [Troubleshooting](#troubleshooting)
9. [Development Workflow](#development-workflow)
10. [API Documentation](#api-documentation)

---

## 🛠 Prerequisites

### Required Software

| Software | Version | Download Link | Purpose |
|----------|---------|---------------|---------|
| **Node.js** | ≥18.0.0 | [nodejs.org](https://nodejs.org) | Backend runtime |
| **npm** | ≥8.0.0 | Included with Node.js | Package manager |
| **Docker** | ≥20.0.0 | [docker.com](https://docker.com) | Containerization |
| **Docker Compose** | ≥2.0.0 | Included with Docker Desktop | Service orchestration |
| **Git** | ≥2.30.0 | [git-scm.com](https://git-scm.com) | Version control |

### System Requirements

- **RAM**: Minimum 8GB (Recommended 16GB)
- **Storage**: Minimum 10GB free space
- **OS**: Windows 10+, macOS 10.15+, Ubuntu 18.04+

### Verification Commands

```bash
# Check all prerequisites
node --version     # Should show v18.0.0 or higher
npm --version      # Should show 8.0.0 or higher
docker --version   # Should show 20.0.0 or higher
docker-compose --version  # Should show 2.0.0 or higher
git --version      # Should show 2.30.0 or higher
```

---

## ⚡ Quick Start

```bash
# 1. Clone repository
git clone https://github.com/your-org/stokcerdas.git
cd stokcerdas

# 2. Check and stop conflicting ports (if needed)
./scripts/check-ports.sh

# 3. Start all services
docker-compose up -d

# 4. Install dependencies
npm install

# 5. Setup database
npm run migration:run
npm run seed:run

# 6. Start development server
npm run dev
```

**🎉 That's it! Your StokCerdas development environment is ready!**

Access the application at: http://localhost:3000/api/docs

---

## 🔌 Port Management

### Required Ports

| Service | Port | URL | Purpose |
|---------|------|-----|---------|
| **StokCerdas API** | 3000 | http://localhost:3000 | Main backend API |
| **PostgreSQL** | 5432 | localhost:5432 | Database |
| **Redis** | 6379 | localhost:6379 | Caching & Sessions |
| **MinIO** | 9000 | http://localhost:9000 | Object Storage |
| **MinIO Console** | 9001 | http://localhost:9001 | Storage Management |
| **RabbitMQ** | 5672 | localhost:5672 | Message Queue |
| **RabbitMQ Management** | 15672 | http://localhost:15672 | Queue Management |
| **Elasticsearch** | 9200 | http://localhost:9200 | Search Engine |
| **Elasticsearch Transport** | 9300 | localhost:9300 | Cluster Communication |
| **Kibana** | 5601 | http://localhost:5601 | Search Dashboard |
| **MailHog SMTP** | 1025 | localhost:1025 | Email Testing |
| **MailHog Web** | 8025 | http://localhost:8025 | Email Dashboard |
| **Jaeger** | 16686 | http://localhost:16686 | Tracing Dashboard |

### Check for Port Conflicts

```bash
# Check if ports are in use (Linux/macOS)
netstat -tulpn | grep -E ":(3000|5432|6379|9000|9001|5672|15672|9200|9300|5601|1025|8025|16686) "

# Check if ports are in use (Windows)
netstat -ano | findstr -E ":(3000|5432|6379|9000|9001|5672|15672|9200|9300|5601|1025|8025|16686) "
```

### Stop Conflicting Services

```bash
# Kill process by port (Linux/macOS)
sudo lsof -t -i:3000 | xargs sudo kill -9
sudo lsof -t -i:5432 | xargs sudo kill -9
sudo lsof -t -i:6379 | xargs sudo kill -9

# Kill process by port (Windows)
FOR /F "tokens=5" %i IN ('netstat -ano ^| findstr :3000') DO taskkill /PID %i /F
FOR /F "tokens=5" %i IN ('netstat -ano ^| findstr :5432') DO taskkill /PID %i /F
FOR /F "tokens=5" %i IN ('netstat -ano ^| findstr :6379') DO taskkill /PID %i /F
```

### Automated Port Cleanup Script

Create this script for easy port management:

```bash
#!/bin/bash
# scripts/stop-ports.sh

echo "🔍 Checking for port conflicts..."

PORTS=(3000 5432 6379 9000 9001 5672 15672 9200 9300 5601 1025 8025 16686)

for port in "${PORTS[@]}"; do
    PID=$(lsof -t -i:$port 2>/dev/null)
    if [ ! -z "$PID" ]; then
        echo "⚠️  Port $port is in use by PID $PID"
        echo "🔪 Killing process on port $port..."
        sudo kill -9 $PID
        echo "✅ Port $port is now free"
    else
        echo "✅ Port $port is available"
    fi
done

echo "🎉 All ports are ready for StokCerdas!"
```

Make it executable:
```bash
chmod +x scripts/stop-ports.sh
./scripts/stop-ports.sh
```

---

## 📖 Step-by-Step Setup

### Step 1: Environment Configuration

The `.env.development` file has been created with secure JWT secrets and proper configuration for all services.

**⚠️ Important**: The JWT secrets have been generated securely. Do NOT commit this file to version control in production!

### Step 2: Start Infrastructure Services

```bash
# Start all Docker services in detached mode
docker-compose up -d

# Verify all services are running
docker-compose ps

# Expected output:
# NAME                          STATUS
# stokcerdas-postgres          Up (healthy)
# stokcerdas-redis             Up (healthy)
# stokcerdas-minio             Up (healthy)
# stokcerdas-rabbitmq          Up (healthy)
# stokcerdas-elasticsearch     Up (healthy)
# stokcerdas-kibana            Up
# stokcerdas-mailhog           Up
# stokcerdas-jaeger           Up
```

### Step 3: Install Dependencies

```bash
# Install backend dependencies
npm install

# Verify installation
npm list --depth=0
```

### Step 4: Database Setup

```bash
# Run database migrations
npm run migration:run

# Expected output:
# Migration CreateInitialSchema1703875200000 has been executed successfully.
# Migration AddIndexesAndConstraints1703875300000 has been executed successfully.
# ... (additional migrations)

# Seed initial data
npm run seed:run

# Expected output:
# 🌱 Seeding initial permissions...
# 🌱 Seeding default roles...
# 🌱 Seeding sample data...
# ✅ Database seeding completed successfully!
```

### Step 5: Start Development Server

```bash
# Start in development mode with hot reload
npm run dev

# Expected output:
# [Nest] 12345  - 07/03/2025, 10:30:00 AM     LOG [Bootstrap] 🚀 StokCerdas API is running on port 3000
# [Nest] 12345  - 07/03/2025, 10:30:00 AM     LOG [Bootstrap] 📖 API Documentation available at http://localhost:3000/api/docs
# [Nest] 12345  - 07/03/2025, 10:30:00 AM     LOG [Bootstrap] 🔗 WebSocket Real-time Gateway available at ws://localhost:3000/realtime
# [Nest] 12345  - 07/03/2025, 10:30:00 AM     LOG [Bootstrap] 🌍 Environment: development
```

---

## 🔧 Services Overview

### Core Services

#### 1. **StokCerdas API** (Port 3000)
- **Purpose**: Main backend application
- **Health Check**: http://localhost:3000/api/v1/health
- **API Documentation**: http://localhost:3000/api/docs
- **WebSocket**: ws://localhost:3000/realtime

#### 2. **PostgreSQL Database** (Port 5432)
- **Purpose**: Primary data storage
- **Connection**: `postgresql://stokcerdas:stokcerdas_password@localhost:5432/stokcerdas_dev`
- **Credentials**: 
  - Username: `stokcerdas`
  - Password: `stokcerdas_password`
  - Database: `stokcerdas_dev`

#### 3. **Redis Cache** (Port 6379)
- **Purpose**: Caching and session storage
- **Connection**: `redis://localhost:6379`
- **Database**: 0 (sessions), 1 (queues)

#### 4. **MinIO Object Storage** (Ports 9000, 9001)
- **Purpose**: File storage (images, documents, exports)
- **API**: http://localhost:9000
- **Console**: http://localhost:9001
- **Credentials**:
  - Access Key: `minioadmin`
  - Secret Key: `minioadmin123`

#### 5. **RabbitMQ Message Queue** (Ports 5672, 15672)
- **Purpose**: Background job processing
- **AMQP**: amqp://localhost:5672
- **Management**: http://localhost:15672
- **Credentials**:
  - Username: `stokcerdas`
  - Password: `stokcerdas_queue`

### Development Tools

#### 6. **Elasticsearch** (Ports 9200, 9300)
- **Purpose**: Search and analytics
- **API**: http://localhost:9200
- **Health**: http://localhost:9200/_cluster/health

#### 7. **Kibana** (Port 5601)
- **Purpose**: Elasticsearch dashboard
- **URL**: http://localhost:5601

#### 8. **MailHog** (Ports 1025, 8025)
- **Purpose**: Email testing
- **SMTP**: localhost:1025
- **Web UI**: http://localhost:8025

#### 9. **Jaeger** (Port 16686)
- **Purpose**: Distributed tracing
- **URL**: http://localhost:16686

---

## ✅ Testing & Verification

### Health Checks

```bash
# Check API health
curl http://localhost:3000/api/v1/health

# Expected response:
# {
#   "status": "ok",
#   "timestamp": "2025-07-03T10:30:00.000Z",
#   "uptime": 123.456,
#   "environment": "development",
#   "version": "1.0.0"
# }

# Check database connection
curl http://localhost:3000/api/v1/health/database

# Check Redis connection
curl http://localhost:3000/api/v1/health/redis

# Check all service health
docker-compose ps --format "table {{.Name}}\t{{.Status}}\t{{.Ports}}"
```

### API Testing

```bash
# Test authentication endpoint
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@stokcerdas.com",
    "password": "password123"
  }'

# Test products endpoint (requires authentication)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/products
```

### WebSocket Testing

```javascript
// Test in browser console
const socket = new WebSocket('ws://localhost:3000/realtime');
socket.onopen = () => console.log('Connected to StokCerdas WebSocket');
socket.onmessage = (event) => console.log('Message:', JSON.parse(event.data));
```

---

## 📱 Mobile App Setup

### Prerequisites for Mobile Development

```bash
# Install React Native CLI
npm install -g @react-native-community/cli

# For iOS (macOS only)
brew install cocoapods

# For Android
# Download Android Studio and set up Android SDK
```

### Setup Mobile App

```bash
# Navigate to mobile directory
cd mobile

# Install dependencies
npm install

# For iOS (macOS only)
cd ios && pod install && cd ..

# For Android - start Metro bundler
npm start

# In new terminal - run on Android
npm run android

# In new terminal - run on iOS (macOS only)
npm run ios
```

### Mobile Configuration

The mobile app is configured to connect to:
- **API**: http://localhost:3000/api/v1
- **WebSocket**: ws://localhost:3000/realtime

---

## 🐛 Troubleshooting

### Common Issues & Solutions

#### 1. **Port Already in Use**

**Error**: `EADDRINUSE: address already in use :::3000`

**Solution**:
```bash
# Find and kill process using port
sudo lsof -t -i:3000 | xargs sudo kill -9

# Or use the port cleanup script
./scripts/stop-ports.sh
```

#### 2. **Docker Services Not Starting**

**Error**: Various Docker-related errors

**Solution**:
```bash
# Stop all containers
docker-compose down

# Remove volumes (⚠️ This will delete data!)
docker-compose down -v

# Rebuild and start
docker-compose up -d --build

# Check logs
docker-compose logs -f
```

#### 3. **Database Connection Failed**

**Error**: `Could not connect to PostgreSQL`

**Solution**:
```bash
# Check if PostgreSQL container is running
docker-compose ps postgres

# Check PostgreSQL logs
docker-compose logs postgres

# Reset database
docker-compose down
docker volume rm stokcerdas_postgres_data
docker-compose up -d postgres
npm run migration:run
```

#### 4. **Migration Errors**

**Error**: Migration-related issues

**Solution**:
```bash
# Check current migration status
npm run migration:show

# Revert last migration
npm run migration:revert

# Run migrations again
npm run migration:run
```

#### 5. **Redis Connection Issues**

**Error**: `Could not connect to Redis`

**Solution**:
```bash
# Check Redis container
docker-compose ps redis

# Test Redis connection
docker exec -it stokcerdas-redis redis-cli ping
# Should return: PONG

# Restart Redis
docker-compose restart redis
```

#### 6. **MinIO Access Issues**

**Error**: Cannot access MinIO or upload files

**Solution**:
```bash
# Check MinIO status
curl http://localhost:9000/minio/health/live

# Access MinIO console and create buckets manually
# URL: http://localhost:9001
# Credentials: minioadmin/minioadmin123
```

### Debugging Commands

```bash
# View all container logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f postgres
docker-compose logs -f redis
docker-compose logs -f minio

# Check container resource usage
docker stats

# Inspect container details
docker inspect stokcerdas-postgres

# Execute commands in containers
docker exec -it stokcerdas-postgres psql -U stokcerdas -d stokcerdas_dev
docker exec -it stokcerdas-redis redis-cli
```

---

## 💻 Development Workflow

### Daily Development Routine

```bash
# 1. Start your day
docker-compose up -d  # Start infrastructure
npm run dev          # Start API in watch mode

# 2. Make changes to code
# Files automatically reload thanks to --watch flag

# 3. Test your changes
npm run test         # Run unit tests
npm run test:e2e     # Run e2e tests
npm run lint         # Check code style
npm run typecheck    # Check TypeScript types

# 4. Database changes
npm run migration:create src/database/migrations/YourMigrationName
npm run migration:run

# 5. End of day
docker-compose stop  # Stop infrastructure (keeps data)
```

### Code Quality Commands

```bash
# Formatting
npm run format       # Format code with Prettier

# Linting
npm run lint         # Check and fix ESLint issues

# Type checking
npm run typecheck    # Verify TypeScript types

# Testing
npm run test         # Unit tests
npm run test:watch   # Unit tests in watch mode
npm run test:cov     # Test coverage report
npm run test:e2e     # End-to-end tests
```

### Database Management

```bash
# Create new migration
npm run migration:create src/database/migrations/AddNewFeature

# Generate migration from entity changes
npm run migration:generate src/database/migrations/UpdateEntities

# Run pending migrations
npm run migration:run

# Revert last migration
npm run migration:revert

# Show migration status
npm run migration:show

# Sync schema (⚠️ Development only!)
npm run schema:sync

# Drop all tables (⚠️ Be careful!)
npm run schema:drop
```

---

## 📚 API Documentation

### Swagger/OpenAPI

- **URL**: http://localhost:3000/api/docs
- **Features**:
  - Interactive API testing
  - Request/response examples
  - Authentication flow
  - Schema documentation

### Key API Endpoints

| Module | Endpoint | Description |
|--------|----------|-------------|
| **Auth** | `POST /api/v1/auth/login` | User authentication |
| **Auth** | `POST /api/v1/auth/register` | User registration |
| **Products** | `GET /api/v1/products` | List products |
| **Products** | `POST /api/v1/products` | Create product |
| **Inventory** | `GET /api/v1/inventory/items` | Inventory levels |
| **Inventory** | `POST /api/v1/inventory/adjustments` | Stock adjustments |
| **Reports** | `GET /api/v1/reports/inventory` | Inventory reports |
| **Alerts** | `GET /api/v1/alerts` | System alerts |

### Authentication

All API endpoints (except auth and health) require JWT authentication:

```bash
# 1. Login to get token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email": "admin@stokcerdas.com", "password": "password123"}'

# 2. Use token in subsequent requests
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  http://localhost:3000/api/v1/products
```

### WebSocket Events

Connect to `ws://localhost:3000/realtime` for real-time updates:

```javascript
const socket = new WebSocket('ws://localhost:3000/realtime');

// Listen for inventory updates
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  if (data.type === 'inventory.updated') {
    console.log('Inventory updated:', data.payload);
  }
};
```

---

## 🎯 Next Steps

### For Backend Development
1. **Explore the codebase**: Start with `src/app.module.ts`
2. **Understand the architecture**: Multi-tenant, RBAC, real-time updates
3. **Add new features**: Follow the existing module structure
4. **Write tests**: Maintain >80% coverage

### For Frontend/Mobile Development
1. **Setup mobile environment**: Install React Native CLI and dependencies
2. **Connect to API**: Use the provided API clients
3. **Implement screens**: Follow the navigation structure

### For Integration Development
1. **Study existing integrations**: Shopee, Tokopedia, Lazada examples
2. **Add new platforms**: Follow the integration pattern
3. **Test webhooks**: Use ngrok for local webhook testing

---

## 📞 Support & Resources

### Documentation
- **Project Overview**: `README.md`
- **Technical Requirements**: `stokcerdas-prd.md`
- **Development Roadmap**: `masterplan.md`
- **Claude Instructions**: `CLAUDE.md`

### Development Resources
- **NestJS Documentation**: https://docs.nestjs.com
- **TypeORM Documentation**: https://typeorm.io
- **React Native Documentation**: https://reactnative.dev

### Indonesian Business Context
- **Timezone**: Asia/Jakarta (WIB/WITA/WIT)
- **Payment Methods**: QRIS, GoPay, OVO, DANA, ShopeePay
- **E-commerce Platforms**: Shopee, Tokopedia, Lazada
- **Logistics**: JNE, J&T Express, Gojek, Grab

---

**🎉 Happy coding with StokCerdas! 🇮🇩**

*Last updated: July 3, 2025*