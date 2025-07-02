const { MigrationInterface, QueryRunner } = require('typeorm');

class CreateEnterprisePermissions1735600000000 {
  name = 'CreateEnterprisePermissions1735600000000';

  async up(queryRunner) {
    // Create ENUM types for enterprise features
    await queryRunner.query(`
      CREATE TYPE "role_level_enum" AS ENUM(
        'EXECUTIVE', 'SENIOR', 'MIDDLE', 'JUNIOR', 'STAFF', 'INTERN'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "user_role_status_enum" AS ENUM(
        'active', 'inactive', 'pending_approval', 'expired', 'suspended'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "assignment_type_enum" AS ENUM(
        'permanent', 'temporary', 'delegation', 'acting', 'project'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "inheritance_type_enum" AS ENUM(
        'full', 'partial', 'additive', 'override'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "hierarchy_status_enum" AS ENUM(
        'active', 'inactive', 'pending'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "permission_set_type_enum" AS ENUM(
        'custom', 'template', 'inherited', 'conditional'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "approval_mode_enum" AS ENUM(
        'sequential', 'parallel', 'majority', 'unanimous', 'any'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "approval_status_enum" AS ENUM(
        'pending', 'approved', 'rejected', 'escalated', 'expired', 'cancelled'
      )
    `);

    await queryRunner.query(`
      CREATE TYPE "approver_type_enum" AS ENUM(
        'user', 'role', 'department', 'external'
      )
    `);

    // Create departments table with closure table support
    await queryRunner.query(`
      CREATE TABLE "departments" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "code" varchar(50) NOT NULL,
        "description" text,
        "parentId" uuid,
        "level" integer NOT NULL DEFAULT 0,
        "path" varchar(500),
        "isActive" boolean NOT NULL DEFAULT true,
        "managerId" uuid,
        "costCenter" varchar(50),
        "budget" decimal(15,2),
        "location" varchar(255),
        "phoneNumber" varchar(20),
        "email" varchar(255),
        "settings" jsonb,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_departments" PRIMARY KEY ("id")
      )
    `);

    // Create departments closure table for hierarchical queries
    await queryRunner.query(`
      CREATE TABLE "departments_closure" (
        "id_ancestor" uuid NOT NULL,
        "id_descendant" uuid NOT NULL,
        PRIMARY KEY ("id_ancestor", "id_descendant")
      )
    `);

    // Create hierarchical_roles table with closure table support
    await queryRunner.query(`
      CREATE TABLE "hierarchical_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "code" varchar(50) NOT NULL,
        "description" text,
        "level" "role_level_enum" NOT NULL DEFAULT 'STAFF',
        "parentId" uuid,
        "isActive" boolean NOT NULL DEFAULT true,
        "inheritsPermissions" boolean NOT NULL DEFAULT true,
        "isSystemRole" boolean NOT NULL DEFAULT false,
        "isCustomizable" boolean NOT NULL DEFAULT true,
        "maxUsers" integer,
        "validFrom" TIMESTAMP,
        "validUntil" TIMESTAMP,
        "settings" jsonb,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_hierarchical_roles" PRIMARY KEY ("id")
      )
    `);

    // Create hierarchical_roles closure table
    await queryRunner.query(`
      CREATE TABLE "hierarchical_roles_closure" (
        "id_ancestor" uuid NOT NULL,
        "id_descendant" uuid NOT NULL,
        PRIMARY KEY ("id_ancestor", "id_descendant")
      )
    `);

    // Create permission_sets table
    await queryRunner.query(`
      CREATE TABLE "permission_sets" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "type" "permission_set_type_enum" NOT NULL DEFAULT 'custom',
        "isActive" boolean NOT NULL DEFAULT true,
        "isSystemSet" boolean NOT NULL DEFAULT false,
        "isTemplate" boolean NOT NULL DEFAULT false,
        "templateId" uuid,
        "conditions" jsonb,
        "validFrom" TIMESTAMP,
        "validUntil" TIMESTAMP,
        "usageCount" integer NOT NULL DEFAULT 0,
        "lastUsedAt" TIMESTAMP,
        "tags" text[],
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_permission_sets" PRIMARY KEY ("id")
      )
    `);

    // Create permission_sets_permissions junction table
    await queryRunner.query(`
      CREATE TABLE "permission_sets_permissions" (
        "permissionSetId" uuid NOT NULL,
        "permissionId" uuid NOT NULL,
        PRIMARY KEY ("permissionSetId", "permissionId")
      )
    `);

    // Create user_roles table
    await queryRunner.query(`
      CREATE TABLE "user_roles" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "user_id" uuid NOT NULL,
        "role_id" uuid NOT NULL,
        "department_id" uuid,
        "permission_set_id" uuid,
        "status" "user_role_status_enum" NOT NULL DEFAULT 'active',
        "assignmentType" "assignment_type_enum" NOT NULL DEFAULT 'permanent',
        "isPrimary" boolean NOT NULL DEFAULT true,
        "priority" integer NOT NULL DEFAULT 0,
        "validFrom" TIMESTAMP,
        "validUntil" TIMESTAMP,
        "lastActiveAt" TIMESTAMP,
        "delegatedBy" uuid,
        "delegatedTo" uuid,
        "delegationReason" text,
        "approved_by" uuid,
        "approvedAt" TIMESTAMP,
        "requested_by" uuid,
        "requestedAt" TIMESTAMP,
        "approvalNotes" text,
        "assignmentReason" varchar(100),
        "projectCode" varchar(100),
        "costCenter" varchar(100),
        "restrictions" jsonb,
        "performanceMetrics" jsonb,
        "requiresReview" boolean NOT NULL DEFAULT false,
        "nextReviewDate" TIMESTAMP,
        "metadata" jsonb,
        "notificationSettings" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_user_roles" PRIMARY KEY ("id")
      )
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_deleted" ON "departments" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_code" ON "departments" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_departments_active" ON "departments" ("isActive")`);

    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_tenant_deleted" ON "hierarchical_roles" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_tenant_code" ON "hierarchical_roles" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_level" ON "hierarchical_roles" ("level")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_active" ON "hierarchical_roles" ("isActive")`);

    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_tenant_deleted" ON "permission_sets" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_type" ON "permission_sets" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_active" ON "permission_sets" ("isActive")`);

    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_deleted" ON "user_roles" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_user" ON "user_roles" ("tenant_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_status" ON "user_roles" ("status")`);

    // Create unique constraints
    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_departments_tenant_code_unique" 
      ON "departments" ("tenant_id", "code") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_hierarchical_roles_tenant_code_unique" 
      ON "hierarchical_roles" ("tenant_id", "code") 
      WHERE "isDeleted" = false
    `);

    console.log('Enterprise permissions tables created successfully!');
  }

  async down(queryRunner) {
    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "user_roles"`);
    await queryRunner.query(`DROP TABLE "permission_sets_permissions"`);
    await queryRunner.query(`DROP TABLE "permission_sets"`);
    await queryRunner.query(`DROP TABLE "hierarchical_roles_closure"`);
    await queryRunner.query(`DROP TABLE "hierarchical_roles"`);
    await queryRunner.query(`DROP TABLE "departments_closure"`);
    await queryRunner.query(`DROP TABLE "departments"`);

    // Drop ENUM types
    await queryRunner.query(`DROP TYPE "approver_type_enum"`);
    await queryRunner.query(`DROP TYPE "approval_status_enum"`);
    await queryRunner.query(`DROP TYPE "approval_mode_enum"`);
    await queryRunner.query(`DROP TYPE "permission_set_type_enum"`);
    await queryRunner.query(`DROP TYPE "hierarchy_status_enum"`);
    await queryRunner.query(`DROP TYPE "inheritance_type_enum"`);
    await queryRunner.query(`DROP TYPE "assignment_type_enum"`);
    await queryRunner.query(`DROP TYPE "user_role_status_enum"`);
    await queryRunner.query(`DROP TYPE "role_level_enum"`);
  }
}

module.exports = { CreateEnterprisePermissions1735600000000 };