import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateEnterprisePermissions1735600000000 implements MigrationInterface {
  name = 'CreateEnterprisePermissions1735600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
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

    // Create role_hierarchies table
    await queryRunner.query(`
      CREATE TABLE "role_hierarchies" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "parent_role_id" uuid NOT NULL,
        "child_role_id" uuid NOT NULL,
        "inheritanceType" "inheritance_type_enum" NOT NULL DEFAULT 'full',
        "status" "hierarchy_status_enum" NOT NULL DEFAULT 'active',
        "depth" integer NOT NULL DEFAULT 1,
        "path" varchar(500),
        "includedPermissions" jsonb,
        "excludedPermissions" jsonb,
        "overriddenPermissions" jsonb,
        "conditions" jsonb,
        "requiresApproval" boolean NOT NULL DEFAULT false,
        "approved_by" uuid,
        "approvedAt" TIMESTAMP,
        "approvalNotes" text,
        "validFrom" TIMESTAMP,
        "validUntil" TIMESTAMP,
        "allowsDelegation" boolean NOT NULL DEFAULT false,
        "allowsSubInheritance" boolean NOT NULL DEFAULT false,
        "maxDelegationDepth" integer,
        "usageCount" integer NOT NULL DEFAULT 0,
        "lastUsedAt" TIMESTAMP,
        "reason" varchar(200),
        "context" varchar(100),
        "metadata" jsonb,
        "notifyOnInheritance" boolean NOT NULL DEFAULT false,
        "notifyOnChanges" boolean NOT NULL DEFAULT false,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_role_hierarchies" PRIMARY KEY ("id")
      )
    `);

    // Create approval_chains table
    await queryRunner.query(`
      CREATE TABLE "approval_chains" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "resourceType" varchar(50) NOT NULL,
        "mode" "approval_mode_enum" NOT NULL DEFAULT 'sequential',
        "isActive" boolean NOT NULL DEFAULT true,
        "isDefault" boolean NOT NULL DEFAULT false,
        "conditions" jsonb,
        "escalationSettings" jsonb,
        "notificationSettings" jsonb,
        "timeoutMinutes" integer NOT NULL DEFAULT 1440,
        "maxSteps" integer NOT NULL DEFAULT 10,
        "allowSkipping" boolean NOT NULL DEFAULT false,
        "allowDelegation" boolean NOT NULL DEFAULT true,
        "requiresComments" boolean NOT NULL DEFAULT false,
        "tags" text[],
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_approval_chains" PRIMARY KEY ("id")
      )
    `);

    // Create approval_steps table
    await queryRunner.query(`
      CREATE TABLE "approval_steps" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "approval_chain_id" uuid NOT NULL,
        "stepOrder" integer NOT NULL,
        "name" varchar(100) NOT NULL,
        "description" text,
        "approverType" "approver_type_enum" NOT NULL DEFAULT 'user',
        "approverId" uuid,
        "isRequired" boolean NOT NULL DEFAULT true,
        "allowsDelegation" boolean NOT NULL DEFAULT true,
        "timeoutMinutes" integer,
        "escalationChainId" uuid,
        "conditions" jsonb,
        "notificationTemplate" text,
        "metadata" jsonb,
        "isDeleted" boolean NOT NULL DEFAULT false,
        "deletedAt" TIMESTAMP,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_approval_steps" PRIMARY KEY ("id")
      )
    `);

    // Create approval_instances table
    await queryRunner.query(`
      CREATE TABLE "approval_instances" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "approval_chain_id" uuid NOT NULL,
        "resourceType" varchar(50) NOT NULL,
        "resourceId" uuid NOT NULL,
        "requesterId" uuid NOT NULL,
        "currentStepId" uuid,
        "status" "approval_status_enum" NOT NULL DEFAULT 'pending',
        "priority" integer NOT NULL DEFAULT 0,
        "startedAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "completedAt" TIMESTAMP,
        "expiresAt" TIMESTAMP,
        "data" jsonb,
        "comments" text,
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_approval_instances" PRIMARY KEY ("id")
      )
    `);

    // Create approval_actions table
    await queryRunner.query(`
      CREATE TABLE "approval_actions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "tenant_id" uuid NOT NULL,
        "approval_instance_id" uuid NOT NULL,
        "approval_step_id" uuid NOT NULL,
        "approverId" uuid NOT NULL,
        "action" varchar(20) NOT NULL,
        "comments" text,
        "actionDate" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "delegatedFrom" uuid,
        "ipAddress" inet,
        "userAgent" varchar(255),
        "metadata" jsonb,
        "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
        "created_by" uuid,
        "updated_by" uuid,
        CONSTRAINT "PK_approval_actions" PRIMARY KEY ("id")
      )
    `);

    // Add foreign key constraints
    await queryRunner.query(`
      ALTER TABLE "departments_closure" 
      ADD CONSTRAINT "FK_departments_closure_ancestor" 
      FOREIGN KEY ("id_ancestor") REFERENCES "departments"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "departments_closure" 
      ADD CONSTRAINT "FK_departments_closure_descendant" 
      FOREIGN KEY ("id_descendant") REFERENCES "departments"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "hierarchical_roles_closure" 
      ADD CONSTRAINT "FK_hierarchical_roles_closure_ancestor" 
      FOREIGN KEY ("id_ancestor") REFERENCES "hierarchical_roles"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "hierarchical_roles_closure" 
      ADD CONSTRAINT "FK_hierarchical_roles_closure_descendant" 
      FOREIGN KEY ("id_descendant") REFERENCES "hierarchical_roles"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "permission_sets_permissions" 
      ADD CONSTRAINT "FK_permission_sets_permissions_set" 
      FOREIGN KEY ("permissionSetId") REFERENCES "permission_sets"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "permission_sets_permissions" 
      ADD CONSTRAINT "FK_permission_sets_permissions_permission" 
      FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles" 
      ADD CONSTRAINT "FK_user_roles_user" 
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles" 
      ADD CONSTRAINT "FK_user_roles_role" 
      FOREIGN KEY ("role_id") REFERENCES "hierarchical_roles"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles" 
      ADD CONSTRAINT "FK_user_roles_department" 
      FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "user_roles" 
      ADD CONSTRAINT "FK_user_roles_permission_set" 
      FOREIGN KEY ("permission_set_id") REFERENCES "permission_sets"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "role_hierarchies" 
      ADD CONSTRAINT "FK_role_hierarchies_parent" 
      FOREIGN KEY ("parent_role_id") REFERENCES "hierarchical_roles"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "role_hierarchies" 
      ADD CONSTRAINT "FK_role_hierarchies_child" 
      FOREIGN KEY ("child_role_id") REFERENCES "hierarchical_roles"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_steps" 
      ADD CONSTRAINT "FK_approval_steps_chain" 
      FOREIGN KEY ("approval_chain_id") REFERENCES "approval_chains"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_instances" 
      ADD CONSTRAINT "FK_approval_instances_chain" 
      FOREIGN KEY ("approval_chain_id") REFERENCES "approval_chains"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_instances" 
      ADD CONSTRAINT "FK_approval_instances_step" 
      FOREIGN KEY ("currentStepId") REFERENCES "approval_steps"("id") ON DELETE SET NULL
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_actions" 
      ADD CONSTRAINT "FK_approval_actions_instance" 
      FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE CASCADE
    `);

    await queryRunner.query(`
      ALTER TABLE "approval_actions" 
      ADD CONSTRAINT "FK_approval_actions_step" 
      FOREIGN KEY ("approval_step_id") REFERENCES "approval_steps"("id") ON DELETE CASCADE
    `);

    // Create indexes for performance
    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_deleted" ON "departments" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_code" ON "departments" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_departments_tenant_parent" ON "departments" ("tenant_id", "parentId")`);
    await queryRunner.query(`CREATE INDEX "IDX_departments_active" ON "departments" ("isActive")`);

    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_tenant_deleted" ON "hierarchical_roles" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_tenant_code" ON "hierarchical_roles" ("tenant_id", "code")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_level" ON "hierarchical_roles" ("level")`);
    await queryRunner.query(`CREATE INDEX "IDX_hierarchical_roles_active" ON "hierarchical_roles" ("isActive")`);

    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_tenant_deleted" ON "permission_sets" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_type" ON "permission_sets" ("type")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_active" ON "permission_sets" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_permission_sets_template" ON "permission_sets" ("isTemplate")`);

    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_deleted" ON "user_roles" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_user" ON "user_roles" ("tenant_id", "user_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_role" ON "user_roles" ("tenant_id", "role_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_tenant_department" ON "user_roles" ("tenant_id", "department_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_status" ON "user_roles" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_assignment_type" ON "user_roles" ("assignmentType")`);
    await queryRunner.query(`CREATE INDEX "IDX_user_roles_priority" ON "user_roles" ("priority")`);

    await queryRunner.query(`CREATE INDEX "IDX_role_hierarchies_tenant_deleted" ON "role_hierarchies" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_role_hierarchies_tenant_parent" ON "role_hierarchies" ("tenant_id", "parent_role_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_role_hierarchies_tenant_child" ON "role_hierarchies" ("tenant_id", "child_role_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_role_hierarchies_status" ON "role_hierarchies" ("status")`);

    await queryRunner.query(`CREATE INDEX "IDX_approval_chains_tenant_deleted" ON "approval_chains" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_chains_resource_type" ON "approval_chains" ("resourceType")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_chains_active" ON "approval_chains" ("isActive")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_chains_default" ON "approval_chains" ("isDefault")`);

    await queryRunner.query(`CREATE INDEX "IDX_approval_steps_tenant_deleted" ON "approval_steps" ("tenant_id", "isDeleted")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_steps_chain_order" ON "approval_steps" ("approval_chain_id", "stepOrder")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_steps_approver" ON "approval_steps" ("approverType", "approverId")`);

    await queryRunner.query(`CREATE INDEX "IDX_approval_instances_tenant_resource" ON "approval_instances" ("tenant_id", "resourceType", "resourceId")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_instances_status" ON "approval_instances" ("status")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_instances_requester" ON "approval_instances" ("requesterId")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_instances_expires" ON "approval_instances" ("expiresAt")`);

    await queryRunner.query(`CREATE INDEX "IDX_approval_actions_instance" ON "approval_actions" ("approval_instance_id")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_actions_approver" ON "approval_actions" ("approverId")`);
    await queryRunner.query(`CREATE INDEX "IDX_approval_actions_date" ON "approval_actions" ("actionDate")`);

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

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_user_roles_unique" 
      ON "user_roles" ("user_id", "role_id", "department_id") 
      WHERE "isDeleted" = false
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "IDX_role_hierarchies_unique" 
      ON "role_hierarchies" ("parent_role_id", "child_role_id") 
      WHERE "isDeleted" = false
    `);

    // Add triggers for updated_at columns
    await queryRunner.query(`
      CREATE TRIGGER update_departments_updated_at 
      BEFORE UPDATE ON "departments" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_hierarchical_roles_updated_at 
      BEFORE UPDATE ON "hierarchical_roles" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_permission_sets_updated_at 
      BEFORE UPDATE ON "permission_sets" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_user_roles_updated_at 
      BEFORE UPDATE ON "user_roles" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_role_hierarchies_updated_at 
      BEFORE UPDATE ON "role_hierarchies" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_approval_chains_updated_at 
      BEFORE UPDATE ON "approval_chains" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_approval_steps_updated_at 
      BEFORE UPDATE ON "approval_steps" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_approval_instances_updated_at 
      BEFORE UPDATE ON "approval_instances" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);

    await queryRunner.query(`
      CREATE TRIGGER update_approval_actions_updated_at 
      BEFORE UPDATE ON "approval_actions" 
      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop triggers
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_approval_actions_updated_at ON "approval_actions"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_approval_instances_updated_at ON "approval_instances"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_approval_steps_updated_at ON "approval_steps"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_approval_chains_updated_at ON "approval_chains"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_role_hierarchies_updated_at ON "role_hierarchies"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_user_roles_updated_at ON "user_roles"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_permission_sets_updated_at ON "permission_sets"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_hierarchical_roles_updated_at ON "hierarchical_roles"`);
    await queryRunner.query(`DROP TRIGGER IF EXISTS update_departments_updated_at ON "departments"`);

    // Drop indexes
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_actions_date"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_actions_approver"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_actions_instance"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_expires"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_requester"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_instances_tenant_resource"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_steps_approver"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_steps_chain_order"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_steps_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_chains_default"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_chains_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_chains_resource_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_approval_chains_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_hierarchies_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_hierarchies_tenant_child"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_hierarchies_tenant_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_hierarchies_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_priority"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_assignment_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_status"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_tenant_department"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_tenant_role"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_tenant_user"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permission_sets_template"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permission_sets_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permission_sets_type"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_permission_sets_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hierarchical_roles_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hierarchical_roles_level"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hierarchical_roles_tenant_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hierarchical_roles_tenant_deleted"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_active"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_parent"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_code"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_deleted"`);

    // Drop unique constraints
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_role_hierarchies_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_user_roles_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_hierarchical_roles_tenant_code_unique"`);
    await queryRunner.query(`DROP INDEX IF EXISTS "IDX_departments_tenant_code_unique"`);

    // Drop foreign key constraints
    await queryRunner.query(`ALTER TABLE "approval_actions" DROP CONSTRAINT IF EXISTS "FK_approval_actions_step"`);
    await queryRunner.query(`ALTER TABLE "approval_actions" DROP CONSTRAINT IF EXISTS "FK_approval_actions_instance"`);
    await queryRunner.query(`ALTER TABLE "approval_instances" DROP CONSTRAINT IF EXISTS "FK_approval_instances_step"`);
    await queryRunner.query(`ALTER TABLE "approval_instances" DROP CONSTRAINT IF EXISTS "FK_approval_instances_chain"`);
    await queryRunner.query(`ALTER TABLE "approval_steps" DROP CONSTRAINT IF EXISTS "FK_approval_steps_chain"`);
    await queryRunner.query(`ALTER TABLE "role_hierarchies" DROP CONSTRAINT IF EXISTS "FK_role_hierarchies_child"`);
    await queryRunner.query(`ALTER TABLE "role_hierarchies" DROP CONSTRAINT IF EXISTS "FK_role_hierarchies_parent"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_user_roles_permission_set"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_user_roles_department"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_user_roles_role"`);
    await queryRunner.query(`ALTER TABLE "user_roles" DROP CONSTRAINT IF EXISTS "FK_user_roles_user"`);
    await queryRunner.query(`ALTER TABLE "permission_sets_permissions" DROP CONSTRAINT IF EXISTS "FK_permission_sets_permissions_permission"`);
    await queryRunner.query(`ALTER TABLE "permission_sets_permissions" DROP CONSTRAINT IF EXISTS "FK_permission_sets_permissions_set"`);
    await queryRunner.query(`ALTER TABLE "hierarchical_roles_closure" DROP CONSTRAINT IF EXISTS "FK_hierarchical_roles_closure_descendant"`);
    await queryRunner.query(`ALTER TABLE "hierarchical_roles_closure" DROP CONSTRAINT IF EXISTS "FK_hierarchical_roles_closure_ancestor"`);
    await queryRunner.query(`ALTER TABLE "departments_closure" DROP CONSTRAINT IF EXISTS "FK_departments_closure_descendant"`);
    await queryRunner.query(`ALTER TABLE "departments_closure" DROP CONSTRAINT IF EXISTS "FK_departments_closure_ancestor"`);

    // Drop tables in reverse order
    await queryRunner.query(`DROP TABLE "approval_actions"`);
    await queryRunner.query(`DROP TABLE "approval_instances"`);
    await queryRunner.query(`DROP TABLE "approval_steps"`);
    await queryRunner.query(`DROP TABLE "approval_chains"`);
    await queryRunner.query(`DROP TABLE "role_hierarchies"`);
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