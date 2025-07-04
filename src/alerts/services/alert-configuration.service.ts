import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import {
  AlertConfiguration,
  AlertType,
  AlertSeverity,
} from '../entities/alert-configuration.entity';
import { Product } from '../../products/entities/product.entity';
import { InventoryLocation } from '../../inventory/entities/inventory-location.entity';
import { CreateAlertConfigurationDto } from '../dto/create-alert-configuration.dto';
import { UpdateAlertConfigurationDto } from '../dto/update-alert-configuration.dto';

@Injectable()
export class AlertConfigurationService {
  constructor(
    @InjectRepository(AlertConfiguration)
    private readonly alertConfigRepository: Repository<AlertConfiguration>,
    @InjectRepository(Product)
    private readonly productRepository: Repository<Product>,
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
  ) {}

  /**
   * Create new alert configuration
   */
  async create(
    tenantId: string,
    createDto: CreateAlertConfigurationDto,
    userId: string,
  ): Promise<AlertConfiguration> {
    // Validate product exists if specified
    if (createDto.productId) {
      await this.validateProduct(tenantId, createDto.productId);
    }

    // Validate location exists if specified
    if (createDto.locationId) {
      await this.validateLocation(tenantId, createDto.locationId);
    }

    // Check for existing configuration with same parameters
    const existing = await this.alertConfigRepository.findOne({
      where: {
        tenantId,
        alertType: createDto.alertType,
        productId: createDto.productId || null,
        locationId: createDto.locationId || null,
      },
    });

    if (existing) {
      throw new ConflictException(
        'Konfigurasi alert untuk kombinasi type/product/location ini sudah ada',
      );
    }

    // Validate alert type specific requirements
    this.validateAlertTypeConfiguration(
      createDto.alertType,
      createDto.configuration,
    );

    const configuration = this.alertConfigRepository.create({
      ...createDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
      isEnabled: createDto.isEnabled ?? true,
      recipientUserIds: createDto.recipientUserIds || [],
      recipientRoles: createDto.recipientRoles || [],
      recipientEmails: createDto.recipientEmails || [],
    });

    return await this.alertConfigRepository.save(configuration);
  }

  /**
   * Find all alert configurations with filtering
   */
  async findAll(
    tenantId: string,
    filters: {
      alertType?: AlertType;
      productId?: string;
      locationId?: string;
      isEnabled?: boolean;
      page?: number;
      limit?: number;
    } = {},
  ): Promise<{
    data: AlertConfiguration[];
    meta: {
      total: number;
      page: number;
      limit: number;
      totalPages: number;
    };
  }> {
    const {
      alertType,
      productId,
      locationId,
      isEnabled,
      page = 1,
      limit = 20,
    } = filters;

    const queryBuilder = this.alertConfigRepository
      .createQueryBuilder('config')
      .leftJoinAndSelect('config.product', 'product')
      .leftJoinAndSelect('config.location', 'location')
      .leftJoinAndSelect('config.creator', 'creator')
      .where('config.tenantId = :tenantId', { tenantId });

    if (alertType) {
      queryBuilder.andWhere('config.alertType = :alertType', { alertType });
    }

    if (productId) {
      queryBuilder.andWhere('config.productId = :productId', { productId });
    }

    if (locationId) {
      queryBuilder.andWhere('config.locationId = :locationId', { locationId });
    }

    if (isEnabled !== undefined) {
      queryBuilder.andWhere('config.isEnabled = :isEnabled', { isEnabled });
    }

    // Count total
    const total = await queryBuilder.getCount();

    // Apply pagination
    const offset = (page - 1) * limit;
    queryBuilder.orderBy('config.createdAt', 'DESC').skip(offset).take(limit);

    const data = await queryBuilder.getMany();

    return {
      data,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Find configuration by ID
   */
  async findOne(tenantId: string, id: string): Promise<AlertConfiguration> {
    const configuration = await this.alertConfigRepository.findOne({
      where: { id, tenantId },
      relations: ['product', 'location', 'creator', 'updater'],
    });

    if (!configuration) {
      throw new NotFoundException('Konfigurasi alert tidak ditemukan');
    }

    return configuration;
  }

  /**
   * Update alert configuration
   */
  async update(
    tenantId: string,
    id: string,
    updateDto: UpdateAlertConfigurationDto,
    userId: string,
  ): Promise<AlertConfiguration> {
    const configuration = await this.findOne(tenantId, id);

    // Validate product exists if specified
    if (updateDto.productId) {
      await this.validateProduct(tenantId, updateDto.productId);
    }

    // Validate location exists if specified
    if (updateDto.locationId) {
      await this.validateLocation(tenantId, updateDto.locationId);
    }

    // Validate alert type configuration if alert type is being changed
    if (
      updateDto.alertType &&
      updateDto.alertType !== configuration.alertType
    ) {
      this.validateAlertTypeConfiguration(
        updateDto.alertType,
        updateDto.configuration,
      );
    }

    // Update configuration
    Object.assign(configuration, updateDto);
    configuration.updatedBy = userId;

    return await this.alertConfigRepository.save(configuration);
  }

  /**
   * Delete alert configuration
   */
  async remove(tenantId: string, id: string): Promise<void> {
    const configuration = await this.findOne(tenantId, id);
    await this.alertConfigRepository.remove(configuration);
  }

  /**
   * Toggle alert configuration enabled status
   */
  async toggleEnabled(
    tenantId: string,
    id: string,
    userId: string,
  ): Promise<AlertConfiguration> {
    const configuration = await this.findOne(tenantId, id);
    configuration.isEnabled = !configuration.isEnabled;
    configuration.updatedBy = userId;

    return await this.alertConfigRepository.save(configuration);
  }

  /**
   * Get configuration for specific product and location
   */
  async getConfigurationForAlert(
    tenantId: string,
    alertType: AlertType,
    productId?: string,
    locationId?: string,
  ): Promise<AlertConfiguration | null> {
    // Priority order:
    // 1. Product + Location specific
    // 2. Product specific
    // 3. Location specific
    // 4. Global configuration

    const configurations = await this.alertConfigRepository.find({
      where: [
        // Product + Location specific
        { tenantId, alertType, productId, locationId, isEnabled: true },
        // Product specific
        { tenantId, alertType, productId, locationId: null, isEnabled: true },
        // Location specific
        { tenantId, alertType, productId: null, locationId, isEnabled: true },
        // Global
        {
          tenantId,
          alertType,
          productId: null,
          locationId: null,
          isEnabled: true,
        },
      ],
      order: {
        createdAt: 'DESC',
      },
    });

    if (!configurations.length) return null;

    // Return most specific configuration
    for (const config of configurations) {
      if (config.productId === productId && config.locationId === locationId) {
        return config;
      }
    }

    for (const config of configurations) {
      if (config.productId === productId && !config.locationId) {
        return config;
      }
    }

    for (const config of configurations) {
      if (!config.productId && config.locationId === locationId) {
        return config;
      }
    }

    // Return global configuration
    return (
      configurations.find(config => !config.productId && !config.locationId) ||
      null
    );
  }

  /**
   * Initialize default alert configurations for tenant
   */
  async initializeDefaultConfigurations(
    tenantId: string,
    userId: string,
  ): Promise<void> {
    const defaultConfigs = [
      {
        alertType: AlertType.LOW_STOCK,
        severity: AlertSeverity.WARNING,
        configuration: {
          reorderPoint: 10,
          enablePushNotification: true,
          enableEmailNotification: false,
          allowSnooze: true,
          maxSnoozeHours: 24,
        },
        recipientRoles: ['ADMIN', 'MANAGER'],
        description: 'Alert untuk stok yang sudah rendah',
      },
      {
        alertType: AlertType.OUT_OF_STOCK,
        severity: AlertSeverity.CRITICAL,
        configuration: {
          enablePushNotification: true,
          enableEmailNotification: true,
          allowSnooze: false,
          escalateAfterHours: 2,
        },
        recipientRoles: ['ADMIN', 'MANAGER'],
        description: 'Alert untuk stok yang habis',
      },
      {
        alertType: AlertType.EXPIRING_SOON,
        severity: AlertSeverity.WARNING,
        configuration: {
          expiryWarningDays: 7,
          enablePushNotification: true,
          enableEmailNotification: false,
          allowSnooze: true,
          maxSnoozeHours: 72,
        },
        recipientRoles: ['ADMIN', 'MANAGER', 'STAFF'],
        description: 'Alert untuk produk yang akan segera expired',
      },
      {
        alertType: AlertType.EXPIRED,
        severity: AlertSeverity.CRITICAL,
        configuration: {
          enablePushNotification: true,
          enableEmailNotification: true,
          allowSnooze: false,
        },
        recipientRoles: ['ADMIN', 'MANAGER'],
        description: 'Alert untuk produk yang sudah expired',
      },
    ];

    for (const configData of defaultConfigs) {
      const existing = await this.alertConfigRepository.findOne({
        where: {
          tenantId,
          alertType: configData.alertType,
          productId: null,
          locationId: null,
        },
      });

      if (!existing) {
        const config = this.alertConfigRepository.create({
          ...configData,
          tenantId,
          createdBy: userId,
          updatedBy: userId,
          recipientUserIds: [],
          recipientEmails: [],
        });

        await this.alertConfigRepository.save(config);
      }
    }
  }

  /**
   * Get alert statistics
   */
  async getStatistics(tenantId: string): Promise<{
    totalConfigurations: number;
    enabledConfigurations: number;
    configurationsByType: Record<string, number>;
    productSpecificConfigurations: number;
    locationSpecificConfigurations: number;
    globalConfigurations: number;
  }> {
    const queryBuilder = this.alertConfigRepository
      .createQueryBuilder('config')
      .where('config.tenantId = :tenantId', { tenantId });

    const [
      totalConfigurations,
      enabledConfigurations,
      configurationsByType,
      productSpecificConfigurations,
      locationSpecificConfigurations,
      globalConfigurations,
    ] = await Promise.all([
      queryBuilder.getCount(),
      queryBuilder.clone().andWhere('config.isEnabled = true').getCount(),
      queryBuilder
        .clone()
        .select('config.alertType', 'alertType')
        .addSelect('COUNT(*)', 'count')
        .groupBy('config.alertType')
        .getRawMany(),
      queryBuilder.clone().andWhere('config.productId IS NOT NULL').getCount(),
      queryBuilder.clone().andWhere('config.locationId IS NOT NULL').getCount(),
      queryBuilder
        .clone()
        .andWhere('config.productId IS NULL')
        .andWhere('config.locationId IS NULL')
        .getCount(),
    ]);

    const configsByType = configurationsByType.reduce((acc, item) => {
      acc[item.alertType] = parseInt(item.count);
      return acc;
    }, {});

    return {
      totalConfigurations,
      enabledConfigurations,
      configurationsByType: configsByType,
      productSpecificConfigurations,
      locationSpecificConfigurations,
      globalConfigurations,
    };
  }

  // Private helper methods
  private async validateProduct(
    tenantId: string,
    productId: string,
  ): Promise<void> {
    const product = await this.productRepository.findOne({
      where: { id: productId, tenantId, isDeleted: false },
    });

    if (!product) {
      throw new NotFoundException('Produk tidak ditemukan');
    }
  }

  private async validateLocation(
    tenantId: string,
    locationId: string,
  ): Promise<void> {
    const location = await this.locationRepository.findOne({
      where: { id: locationId, tenantId, isDeleted: false },
    });

    if (!location) {
      throw new NotFoundException('Lokasi tidak ditemukan');
    }
  }

  private validateAlertTypeConfiguration(
    alertType: AlertType,
    configuration?: any,
  ): void {
    if (!configuration) return;

    switch (alertType) {
      case AlertType.LOW_STOCK:
      case AlertType.REORDER_NEEDED:
        if (
          configuration.reorderPoint !== undefined &&
          configuration.reorderPoint < 0
        ) {
          throw new BadRequestException('Reorder point harus >= 0');
        }
        break;

      case AlertType.EXPIRING_SOON:
        if (configuration.expiryWarningDays !== undefined) {
          if (
            configuration.expiryWarningDays < 1 ||
            configuration.expiryWarningDays > 365
          ) {
            throw new BadRequestException(
              'Expiry warning days harus antara 1-365',
            );
          }
        }
        break;

      case AlertType.SYSTEM_MAINTENANCE:
        if (!configuration.maintenanceMessage) {
          throw new BadRequestException(
            'Maintenance message diperlukan untuk system maintenance alert',
          );
        }
        break;
    }
  }
}
