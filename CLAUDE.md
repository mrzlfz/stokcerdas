# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

StokCerdas is an AI-powered inventory intelligence SaaS platform designed for Indonesian SMBs. The platform addresses inventory management challenges through intelligent demand forecasting, automated reorder optimization, and real-time multi-channel synchronization.

### Key Project Files
- `stokcerdas-prd.md` - Product Requirements Document with complete specifications
- `masterplan.md` - Development roadmap with 150 tasks across 3 phases (12 months)

## Development Setup Commands

Since the project implementation hasn't started yet, here are the planned technology stack and commands:

### Backend (Node.js with NestJS)
```bash
# Project setup (when initialized)
npm install
npm run dev              # Start development server
npm run build            # Build for production
npm run test             # Run unit tests
npm run test:e2e         # Run end-to-end tests
npm run lint             # Run ESLint
npm run typecheck        # Run TypeScript type checking
```

### Database (PostgreSQL with Docker)
```bash
# Start local development environment
docker-compose up -d     # Start all services (PostgreSQL, Redis, MinIO, RabbitMQ, Elasticsearch)
docker-compose down      # Stop all services
docker-compose logs -f   # View logs

# Database migrations (when implemented)
npm run migration:create # Create new migration
npm run migration:run    # Run pending migrations
npm run migration:revert # Revert last migration
```

### Mobile (React Native)
```bash
# When mobile development starts
npm install
npm run android          # Run on Android
npm run ios             # Run on iOS
npm run test            # Run mobile tests
```

## Architecture Overview

### Multi-Tenant Architecture
- **Strategy**: Hybrid approach with shared infrastructure and logical data isolation
- **Tenant Isolation**: Row-level security using `tenant_id` in all tables
- **Key Tables**: products, inventory_locations, inventory_transactions

### Technology Stack
- **Backend**: Node.js with NestJS framework
- **Database**: PostgreSQL (primary), Redis (caching)
- **Real-time**: Socket.io for WebSocket connections
- **Queue**: RabbitMQ for async processing
- **Search**: Elasticsearch
- **Storage**: AWS S3 (production), MinIO (development)

### API Design Principles
- RESTful API with versioning (`/api/v1/`)
- JWT authentication with refresh tokens
- Standardized response format with success, data, and meta fields
- Rate limiting per tenant
- Multi-factor authentication (MFA) support

### Development Phases

**Phase 1 (Months 1-3): MVP**
- Technical foundation setup
- Core backend features (products, inventory tracking)
- Mobile app with barcode scanning
- Alert system and basic reporting

**Phase 2 (Months 4-6): Growth Features**
- AI-powered demand forecasting (ARIMA, Prophet, XGBoost)
- Multi-channel integration (Tokopedia, Shopee, Lazada)
- POS integrations (Moka, Pawoon)
- Advanced analytics

**Phase 3 (Months 7-12): Scale & Enhancement**
- Automation features
- Enterprise capabilities
- Additional integrations
- SOC 2 certification

## Indonesian Localization Requirements

### Language & Culture
- Primary language: Bahasa Indonesia
- Avoid red/white combinations (national flag)
- Use hierarchical information display
- Mobile-first design (85% of users on mobile)

### Payment Integration
- QRIS (unified QR payment)
- E-wallets: GoPay, OVO, DANA, ShopeePay
- Local payment gateways: Xendit, Midtrans

### Timezone Support
- WIB (Western Indonesia Time)
- WITA (Central Indonesia Time)
- WIT (Eastern Indonesia Time)

## Testing Requirements
- Minimum 80% code coverage for unit tests
- Integration tests for all third-party APIs
- Performance testing for 10K concurrent users
- Security testing following OWASP guidelines

## Progress Tracking

When implementing tasks:
1. Always update `masterplan.md` with progress
2. Mark checkboxes as completed: `[ ]` → `[x]`
3. Update progress percentages and status indicators
4. Add completion dates to finished tasks
5. Update the Progress Dashboard weekly

## Security & Compliance
- Implement UU PDP (Indonesian Personal Data Protection Law) compliance
- Follow SOC 2 Type II requirements
- Encrypt data at rest (AES-256) and in transit (TLS 1.3)
- Implement proper RBAC (Role-Based Access Control)

## Critical Performance Targets
- API response time: <200ms (p95)
- Page load time: <2 seconds
- Real-time updates: <100ms latency
- 99.9% uptime SLA

## Development Best Practices for StokCerdas

1. **Multi-tenant Safety**: Always include `tenant_id` in queries and ensure tenant isolation
2. **Indonesian Context**: Test with Indonesian phone numbers, addresses, and payment methods
3. **Mobile-First**: Design and test primarily for mobile devices
4. **Offline Support**: Implement offline-first architecture for unreliable connections
5. **Integration Testing**: Mock all third-party APIs (Tokopedia, Shopee, etc.) for testing

## Reporting Requirements

When implementing any task:
1. Create a clear implementation report explaining what was done
2. Document any deviations from the original plan
3. List all files created or modified
4. Provide testing instructions
5. Note any dependencies or blockers

Remember to check the PRD and masterplan for detailed requirements before implementing any feature.