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

## Project Status & Implementation Workflow

This project follows a structured 3-phase development plan with 150 tasks across 12 months. Before implementing any feature:

1. **Check Current Phase**: Review `masterplan.md` to understand which phase and week you're in
2. **Verify Dependencies**: Each task has clear dependencies - don't start a task until its prerequisites are complete
3. **Update Progress**: Always update task progress in `masterplan.md` using the defined status indicators
4. **Follow Critical Path**: Priority should be given to critical path items that block other work

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

## Progress Tracking System

The project uses a comprehensive tracking system in `masterplan.md`:

### Status Indicators
- 🔴 Not Started (0%)
- 🟡 In Progress (1-99%)
- 🟢 Completed (100%)
- ⏸️ On Hold
- ❌ Blocked

### Required Updates When Implementing
1. **Task Level**: Update progress percentage and status indicator
2. **Subtask Level**: Check off completed items with completion dates
3. **Phase Tracker**: Update weekly checkpoint tables
4. **Dashboard**: Update overall progress at top of masterplan
5. **Dependencies**: Note any new blockers or dependency changes

### Critical Path Awareness
Key dependency chains that must be followed:
- Development Environment → Backend Architecture → Core Features
- Backend API → Mobile Foundation → Mobile Features
- Core Features → AI Models → Advanced Analytics
- All MVP Features → Growth Features → Scale Features

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

## Implementation Guidelines

### Pre-Implementation Checklist
1. **Review PRD**: Check `stokcerdas-prd.md` for detailed requirements
2. **Check Masterplan**: Verify task dependencies and current phase status
3. **Verify Multi-tenant**: Ensure all database operations include `tenant_id`
4. **Indonesian Context**: Test with local data (phone numbers, addresses, payments)
5. **Mobile-First**: Design for mobile users primarily (85% of user base)

### Post-Implementation Requirements
1. **Update Progress**: Mark tasks complete in `masterplan.md` with dates
2. **Testing**: Achieve minimum 80% code coverage
3. **Documentation**: Update relevant documentation files
4. **Performance**: Verify API responses <200ms, real-time updates <100ms
5. **Security**: Ensure proper tenant isolation and data encryption

### Reporting Format
When completing tasks, provide:
- Summary of what was implemented
- Files created/modified
- Testing approach and results
- Any deviations from original plan
- Dependencies or blockers identified
- Next steps or follow-up items needed

Remember: This is a 12-month, 150-task project. Focus on the current phase requirements and maintain the critical path progression.

## Project Workflow Memories

- selalu baca @CLAUDE.md dan @masterplan.md terlebih dahulu
- selalu baca @CLAUDE.md dan @masterplan.md terlibih dahulu untuk implementasi