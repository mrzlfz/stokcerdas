# Database Schema Analysis Report - Column Naming Inconsistencies

**Date**: 2025-01-09  
**Phase**: 2.1 - Database Schema Analysis  
**Status**: Critical Issues Found ⚠️

## Executive Summary

The database schema has critical **column naming inconsistencies** that are preventing the performance optimization indexes migration from running. This is blocking significant performance improvements and needs immediate resolution.

## Key Findings

### 1. Column Naming Pattern Inconsistencies

| Entity | Base Class | Table Name | Column Naming | Consistency |
|--------|------------|------------|---------------|-------------|
| **BaseEntity** | - | - | **snake_case** (tenant_id, created_at, updated_at) | ✅ Standard |
| **AuditableEntity** | BaseEntity | - | **snake_case** (is_deleted, deleted_at, deleted_by) | ✅ Standard |
| **User** | BaseEntity | users | **camelCase** (email, firstName, lastName) | ❌ Inconsistent |
| **Product** | BaseEntity | products | **camelCase** (sku, name, costPrice) | ❌ Inconsistent |
| **ProductCategory** | BaseEntity | product_categories | **camelCase** (name, parentId, sortOrder) | ❌ Inconsistent |
| **InventoryItem** | BaseEntity | inventory_items | **camelCase** (productId, quantityOnHand) | ❌ Inconsistent |
| **InventoryTransaction** | BaseEntity | inventory_transactions | **camelCase** (productId, type, quantity) | ❌ Inconsistent |
| **Supplier** | AuditableEntity | suppliers | **camelCase** (code, name, email) | ❌ Inconsistent |

### 2. Specific Issues

#### A. Base Entity Pattern (Correct)
```typescript
// src/common/entities/base.entity.ts
@Column({ type: 'uuid', name: 'tenant_id' })
tenantId: string;

@CreateDateColumn({ name: 'created_at' })
createdAt: Date;

@UpdateDateColumn({ name: 'updated_at' })
updatedAt: Date;
```

#### B. Application Entity Pattern (Inconsistent)
```typescript
// All other entities use camelCase without explicit column names
@Column({ type: 'varchar', length: 100 })
sku: string;  // Creates column "sku" not "sku" - should be "sku" or with name: 'sku'

@Column({ type: 'uuid' })
productId: string;  // Creates column "productId" not "product_id"
```

### 3. Soft Delete Support Analysis

| Entity | Has Soft Delete | Implementation | Status |
|--------|-----------------|----------------|---------|
| **User** | ✅ Yes | Manual fields (isDeleted, deletedAt) | ❌ Inconsistent with AuditableEntity |
| **Product** | ✅ Yes | Manual fields (isDeleted, deletedAt) | ❌ Inconsistent with AuditableEntity |
| **Supplier** | ✅ Yes | Extends AuditableEntity | ✅ Correct |
| **InventoryItem** | ❌ No | No soft delete support | ❌ Missing |
| **InventoryTransaction** | ❌ No | No soft delete support | ❌ Missing |
| **ProductCategory** | ❌ No | No soft delete support | ❌ Missing |

### 4. Index Patterns Analysis

Current indexes use TypeScript property names, which means they're referencing:
- `tenantId` (camelCase property)
- But database columns could be either `tenantId` or `tenant_id` depending on entity

**Critical Issue**: The performance migration expects snake_case column names but entities create camelCase column names.

## Root Cause Analysis

1. **BaseEntity was designed with snake_case pattern** using explicit `name` attributes
2. **All application entities ignore this pattern** by not using `name` attributes
3. **TypeORM creates column names from property names when no explicit name provided**
4. **Migration files assume snake_case column names** but actual columns are camelCase

## Impact Assessment

### Performance Impact
- **Performance optimization indexes are disabled** (significant performance degradation)
- **Query performance is suboptimal** without proper indexing
- **Indonesian SMB scale testing is blocked** (1000+ products, 500+ orders/day)

### Development Impact
- **Schema mismatch prevents migrations** from running
- **Inconsistent patterns confuse developers**
- **Database queries may fail** with column name errors

### Business Impact
- **Production deployment is at risk**
- **Performance SLAs cannot be met** (<200ms API response time)
- **Indonesian business requirements are blocked**

## Recommended Solutions

### Option 1: Standardize to snake_case (Recommended)
**Pros**: Follows PostgreSQL conventions, consistent with BaseEntity
**Cons**: Requires column name updates in all entities

### Option 2: Standardize to camelCase
**Pros**: Matches TypeScript property names
**Cons**: Goes against PostgreSQL conventions, requires BaseEntity changes

### Option 3: Hybrid Approach
**Pros**: Minimal changes
**Cons**: Maintains inconsistency, confusing for developers

## Immediate Action Items

### Phase 2.2: Fix Missing Soft Delete Columns
- [ ] Update User entity to extend AuditableEntity
- [ ] Update Product entity to extend AuditableEntity  
- [ ] Add soft delete support to InventoryItem
- [ ] Add soft delete support to InventoryTransaction
- [ ] Add soft delete support to ProductCategory

### Phase 2.3: Implement Performance Indexes
- [ ] Align column naming convention
- [ ] Update performance migration with correct column names
- [ ] Add comprehensive indexes for:
  - Products table (sku, name, tenant_id, category_id)
  - Inventory tables (product_id, location_id, tenant_id)
  - Analytics tables (tenant_id, date ranges)

### Phase 2.4: Test and Validate
- [ ] Run database migrations successfully
- [ ] Validate index effectiveness
- [ ] Test query performance improvements
- [ ] Verify Indonesian business context compatibility

## Technical Implementation Plan

### Step 1: Choose Naming Convention
**Decision**: Use snake_case for consistency with BaseEntity and PostgreSQL conventions

### Step 2: Update Entity Definitions
```typescript
// Example: Update Product entity
@Column({ type: 'varchar', length: 100, name: 'sku' })
sku: string;

@Column({ type: 'varchar', length: 255, name: 'name' })
name: string;

@Column({ type: 'uuid', name: 'category_id' })
categoryId: string;
```

### Step 3: Create Migration for Schema Alignment
```sql
-- Example: Rename columns to snake_case
ALTER TABLE products RENAME COLUMN "categoryId" TO "category_id";
ALTER TABLE products RENAME COLUMN "costPrice" TO "cost_price";
ALTER TABLE products RENAME COLUMN "sellingPrice" TO "selling_price";
```

### Step 4: Update Performance Indexes Migration
```typescript
// Create proper performance indexes with correct column names
await queryRunner.query(`
  CREATE INDEX CONCURRENTLY "idx_products_tenant_sku" 
  ON products (tenant_id, sku) WHERE is_deleted = false;
`);
```

## Testing Strategy

### Unit Tests
- [ ] Test entity column mapping
- [ ] Test soft delete functionality
- [ ] Test index usage in queries

### Integration Tests
- [ ] Test Indonesian business context
- [ ] Test multi-tenant isolation
- [ ] Test performance with large datasets

### Performance Tests
- [ ] Benchmark query performance before/after indexes
- [ ] Test with 1000+ products
- [ ] Test with 500+ orders/day load

## Risk Mitigation

### Data Migration Risks
- **Backup database before schema changes**
- **Test migration on staging environment**
- **Plan rollback procedures**

### Performance Risks
- **Monitor query performance during migration**
- **Use CONCURRENTLY for index creation**
- **Plan maintenance windows**

## Success Criteria

### Technical Success
- [ ] All entities use consistent column naming
- [ ] Performance migration runs successfully
- [ ] Database queries achieve <200ms response time (p95)
- [ ] All TypeScript compilation errors resolved

### Business Success
- [ ] Indonesian SMB scale testing passes
- [ ] Multi-tenant isolation maintained
- [ ] Audit trails work correctly
- [ ] Soft delete functionality operational

## Next Steps

1. **Get approval for snake_case standardization**
2. **Create detailed migration plan**
3. **Implement entity updates**
4. **Create schema alignment migration**
5. **Update performance indexes migration**
6. **Test thoroughly on staging**
7. **Deploy to production**

---

**Priority**: 🔴 Critical  
**Effort**: High (3-4 days)  
**Risk**: Medium (mitigated with proper testing)  
**Business Impact**: High (performance and scalability)

*This analysis is part of Phase 2.1 of the StokCerdas performance optimization initiative.*