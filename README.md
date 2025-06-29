# StokCerdas - AI-Powered Inventory Intelligence Platform

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/Node.js-18.x-green.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-blue.svg)](https://www.typescriptlang.org/)
[![NestJS](https://img.shields.io/badge/NestJS-10.x-red.svg)](https://nestjs.com/)

StokCerdas is an AI-powered inventory intelligence SaaS platform designed specifically for Indonesian SMBs. The platform addresses inventory management challenges through intelligent demand forecasting, automated reorder optimization, and real-time multi-channel synchronization.

## 🚀 Features

### Phase 1 (MVP)
- **Product Management**: Comprehensive product catalog with SKU management
- **Inventory Tracking**: Real-time inventory levels across multiple locations
- **Mobile App**: React Native app with barcode scanning
- **Alert System**: Low stock and expiry date notifications
- **Basic Reporting**: Inventory valuation and movement reports

### Phase 2 (Growth)
- **AI Forecasting**: ARIMA, Prophet, and XGBoost-based demand prediction
- **Multi-Channel Integration**: Tokopedia, Shopee, Lazada synchronization
- **POS Integration**: Moka and Pawoon POS system connectivity
- **Advanced Analytics**: Business intelligence and performance insights

### Phase 3 (Scale)
- **Automation**: Automated purchasing and workflow management
- **Enterprise Features**: Multi-entity support and advanced permissions
- **Compliance**: SOC 2 Type II and UU PDP compliance
- **Performance**: Microservices architecture for scale

## 🏗️ Architecture

### Technology Stack
- **Backend**: Node.js with NestJS framework
- **Database**: PostgreSQL (primary), Redis (caching)
- **Real-time**: Socket.io for WebSocket connections
- **Queue**: RabbitMQ for async processing
- **Search**: Elasticsearch for full-text search
- **Storage**: AWS S3 (production), MinIO (development)
- **Mobile**: React Native with offline-first architecture

### Multi-Tenant Architecture
- **Strategy**: Hybrid approach with shared infrastructure
- **Isolation**: Row-level security using `tenant_id`
- **Scalability**: Designed for 10,000+ concurrent users

## 🛠️ Development Setup

### Prerequisites
- Node.js 18.x or higher
- Docker and Docker Compose
- Git

### Quick Start

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd stokcerdas
   ```

2. **Start development environment**
   ```bash
   docker-compose up -d
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Run database migrations**
   ```bash
   npm run migration:run
   ```

5. **Start development server**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000`

### Development Commands

```bash
# Development
npm run dev              # Start development server
npm run build            # Build for production
npm run start:prod       # Start production server

# Database
npm run migration:create # Create new migration
npm run migration:run    # Run pending migrations
npm run migration:revert # Revert last migration

# Testing
npm run test             # Run unit tests
npm run test:watch       # Run tests in watch mode
npm run test:e2e         # Run end-to-end tests
npm run test:cov         # Run tests with coverage

# Code Quality
npm run lint             # Run ESLint
npm run lint:fix         # Fix ESLint issues
npm run typecheck        # Run TypeScript type checking
npm run format           # Format code with Prettier
```

### Docker Services

The development environment includes:

- **PostgreSQL**: Primary database (port 5432)
- **Redis**: Caching and session store (port 6379)
- **MinIO**: S3-compatible object storage (port 9000)
- **RabbitMQ**: Message queue (port 5672, management: 15672)
- **Elasticsearch**: Search engine (port 9200)

### Environment Configuration

Create environment files for different stages:

- `.env.development` - Development environment
- `.env.staging` - Staging environment
- `.env.production` - Production environment

## 📱 Mobile Development

### Setup React Native Environment

1. **Install React Native CLI**
   ```bash
   npm install -g @react-native-community/cli
   ```

2. **Navigate to mobile directory**
   ```bash
   cd mobile
   npm install
   ```

3. **Run on device/simulator**
   ```bash
   npm run android  # Android
   npm run ios      # iOS
   ```

## 🧪 Testing

### Testing Strategy
- **Unit Tests**: >80% code coverage requirement
- **Integration Tests**: All third-party API integrations
- **E2E Tests**: Critical user workflows
- **Performance Tests**: 10K concurrent users capability

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:e2e

# Generate coverage report
npm run test:cov
```

## 🚀 Deployment

### Production Deployment

1. **Build the application**
   ```bash
   npm run build
   ```

2. **Deploy with Docker**
   ```bash
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Run database migrations**
   ```bash
   npm run migration:run
   ```

### Infrastructure

- **Development**: Docker Compose locally
- **Staging/Production**: AWS ECS with Terraform
- **CI/CD**: GitHub Actions
- **Monitoring**: AWS CloudWatch + Custom metrics

## 🌏 Indonesian Localization

### Key Features
- **Language**: Primary support for Bahasa Indonesia
- **Payments**: QRIS, GoPay, OVO, DANA, ShopeePay integration
- **Timezone**: WIB, WITA, WIT support
- **Compliance**: UU PDP (Indonesian Personal Data Protection Law)

### Cultural Considerations
- Mobile-first design (85% mobile users)
- Hierarchical information display
- Local business practice integration

## 📊 Performance Targets

- **API Response**: <200ms (p95)
- **Page Load**: <2 seconds
- **Real-time Updates**: <100ms latency
- **Uptime**: 99.9% SLA
- **Concurrent Users**: 10,000+

## 📋 Development Guidelines

### Code Standards
- **Language**: TypeScript for type safety
- **Linting**: ESLint with Prettier
- **Testing**: Jest for unit tests, Supertest for integration
- **Documentation**: TSDoc for code documentation

### Git Workflow
- **Branching**: GitFlow with feature branches
- **Commits**: Conventional commit messages
- **Reviews**: Mandatory code review before merge
- **CI/CD**: Automated testing and deployment

### Security Requirements
- **Authentication**: JWT with refresh tokens
- **Authorization**: Role-based access control (RBAC)
- **Data**: Encryption at rest (AES-256) and in transit (TLS 1.3)
- **Compliance**: SOC 2 Type II certification target

## 📚 Documentation

- [Product Requirements Document](./stokcerdas-prd.md)
- [Master Development Plan](./masterplan.md)
- [Claude AI Instructions](./CLAUDE.md)
- [API Documentation](./docs/api.md) *(Coming Soon)*
- [Architecture Guide](./docs/architecture.md) *(Coming Soon)*

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For support and questions:
- Create an issue in this repository
- Contact the development team
- Check the documentation in `/docs`

---

**Built with ❤️ for Indonesian SMBs**