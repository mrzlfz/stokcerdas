import { DataSource } from 'typeorm';
import { Permission, PermissionResource, PermissionAction } from '../../auth/entities/permission.entity';
import { RolePermission } from '../../auth/entities/role-permission.entity';
import { UserRole } from '../../users/entities/user.entity';

export class PermissionsSeed {
  static async run(dataSource: DataSource): Promise<void> {
    console.log('🔐 Seeding permissions and role permissions...');

    const permissionRepository = dataSource.getRepository(Permission);
    const rolePermissionRepository = dataSource.getRepository(RolePermission);

    // Default permissions configuration
    const defaultPermissions = this.getDefaultPermissions();

    // Create permissions
    for (const permissionData of defaultPermissions) {
      const existing = await permissionRepository.findOne({
        where: {
          resource: permissionData.resource,
          action: permissionData.action,
        },
      });

      if (!existing) {
        const permission = permissionRepository.create(permissionData);
        await permissionRepository.save(permission);
        console.log(`✅ Created permission: ${permission.name}`);
      }
    }

    // Create role permissions
    const rolePermissionsConfig = this.getDefaultRolePermissions();

    for (const config of rolePermissionsConfig) {
      const permission = await permissionRepository.findOne({
        where: {
          resource: config.resource,
          action: config.action,
        },
      });

      if (permission) {
        for (const role of config.roles) {
          const existing = await rolePermissionRepository.findOne({
            where: {
              role,
              permissionId: permission.id,
            },
          });

          if (!existing) {
            const rolePermission = rolePermissionRepository.create({
              role,
              permissionId: permission.id,
            });
            await rolePermissionRepository.save(rolePermission);
            console.log(`✅ Granted ${role} permission: ${permission.name}`);
          }
        }
      }
    }

    console.log('🎉 Permissions seeding completed!');
  }

  private static getDefaultPermissions() {
    const resources = Object.values(PermissionResource);
    const actions = Object.values(PermissionAction);
    const permissions = [];

    for (const resource of resources) {
      for (const action of actions) {
        const isSystemPermission = 
          action === PermissionAction.VIEW_ALL || 
          action === PermissionAction.MANAGE_SYSTEM;

        permissions.push({
          resource,
          action,
          name: `${this.capitalizeFirst(resource)} ${this.formatAction(action)}`,
          description: `${this.formatAction(action).toUpperCase()} ${resource}`,
          isSystemPermission,
        });
      }
    }

    return permissions;
  }

  private static getDefaultRolePermissions() {
    return [
      // ADMIN: Most permissions except system management
      { resource: PermissionResource.USERS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.USERS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.USERS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.USERS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      
      // Product permissions
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.IMPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.PRODUCTS, action: PermissionAction.EXPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      // Inventory permissions
      { resource: PermissionResource.INVENTORY, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.ADJUST, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.TRANSFER, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.INVENTORY, action: PermissionAction.EXPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      // Location permissions
      { resource: PermissionResource.LOCATIONS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.LOCATIONS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.LOCATIONS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
      { resource: PermissionResource.LOCATIONS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      
      // Transaction permissions
      { resource: PermissionResource.TRANSACTIONS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.TRANSACTIONS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.TRANSACTIONS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.TRANSACTIONS, action: PermissionAction.CANCEL, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.TRANSACTIONS, action: PermissionAction.APPROVE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      // Report permissions
      { resource: PermissionResource.REPORTS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.REPORTS, action: PermissionAction.EXPORT, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      // Analytics permissions
      { resource: PermissionResource.ANALYTICS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      
      // Settings permissions
      { resource: PermissionResource.SETTINGS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.SETTINGS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
      
      // Supplier permissions
      { resource: PermissionResource.SUPPLIERS, action: PermissionAction.CREATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.SUPPLIERS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER, UserRole.STAFF] },
      { resource: PermissionResource.SUPPLIERS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.SUPPLIERS, action: PermissionAction.DELETE, roles: [UserRole.ADMIN] },
      
      // Integration permissions
      { resource: PermissionResource.INTEGRATIONS, action: PermissionAction.READ, roles: [UserRole.ADMIN, UserRole.MANAGER] },
      { resource: PermissionResource.INTEGRATIONS, action: PermissionAction.UPDATE, roles: [UserRole.ADMIN] },
    ];
  }

  private static capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  private static formatAction(action: string): string {
    return action.replace('_', ' ').toLowerCase();
  }
}