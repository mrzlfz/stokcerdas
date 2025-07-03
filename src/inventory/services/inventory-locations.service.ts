import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Like, TreeRepository, IsNull, Not } from 'typeorm';

import { InventoryLocation, LocationStatus } from '../entities/inventory-location.entity';
import { CreateInventoryLocationDto } from '../dto/create-inventory-location.dto';
import { UpdateInventoryLocationDto } from '../dto/update-inventory-location.dto';
import { InventoryRealtimeService } from './inventory-realtime.service';

@Injectable()
export class InventoryLocationsService {
  constructor(
    @InjectRepository(InventoryLocation)
    private readonly locationRepository: Repository<InventoryLocation>,
    private readonly realtimeService: InventoryRealtimeService,
  ) {}

  /**
   * Buat lokasi inventori baru
   */
  async create(
    tenantId: string,
    createLocationDto: CreateInventoryLocationDto,
    userId: string,
  ): Promise<InventoryLocation> {
    // Validasi kode lokasi unik
    await this.validateCodeUnique(tenantId, createLocationDto.code);

    // Validasi parent jika ada
    if (createLocationDto.parentId) {
      await this.validateParentLocation(tenantId, createLocationDto.parentId);
    }

    // Validasi business rules
    this.validateBusinessRules(createLocationDto);

    const location = this.locationRepository.create({
      ...createLocationDto,
      tenantId,
      createdBy: userId,
      updatedBy: userId,
    });

    const savedLocation = await this.locationRepository.save(location);

    // Emit real-time location update
    await this.realtimeService.emitLocationUpdate(tenantId, savedLocation);

    return savedLocation;
  }

  /**
   * Dapatkan semua lokasi dengan filter
   */
  async findAll(
    tenantId: string,
    includeInactive: boolean = false,
    parentId?: string,
  ): Promise<InventoryLocation[]> {
    const whereCondition: any = {
      tenantId,
      isDeleted: false,
    };

    if (!includeInactive) {
      whereCondition.status = LocationStatus.ACTIVE;
    }

    if (parentId !== undefined) {
      whereCondition.parentId = parentId === 'null' ? IsNull() : parentId;
    }

    return await this.locationRepository.find({
      where: whereCondition,
      relations: ['parent', 'children'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Dapatkan struktur hierarki lokasi
   */
  async findHierarchy(tenantId: string, includeInactive: boolean = false): Promise<InventoryLocation[]> {
    const whereCondition: any = {
      tenantId,
      isDeleted: false,
      parentId: IsNull(), // Hanya root locations
    };

    if (!includeInactive) {
      whereCondition.status = LocationStatus.ACTIVE;
    }

    const rootLocations = await this.locationRepository.find({
      where: whereCondition,
      relations: ['children', 'children.children', 'children.children.children'], // 3 levels deep
      order: { name: 'ASC' },
    });

    return rootLocations;
  }

  /**
   * Dapatkan detail lokasi
   */
  async findOne(tenantId: string, id: string): Promise<InventoryLocation> {
    const location = await this.locationRepository.findOne({
      where: { id, tenantId, isDeleted: false },
      relations: ['parent', 'children'],
    });

    if (!location) {
      throw new NotFoundException('Lokasi inventori tidak ditemukan');
    }

    return location;
  }

  /**
   * Cari lokasi berdasarkan kode
   */
  async findByCode(tenantId: string, code: string): Promise<InventoryLocation> {
    const location = await this.locationRepository.findOne({
      where: { code, tenantId, isDeleted: false },
      relations: ['parent', 'children'],
    });

    if (!location) {
      throw new NotFoundException('Lokasi dengan kode tersebut tidak ditemukan');
    }

    return location;
  }

  /**
   * Cari lokasi berdasarkan nama
   */
  async findByName(tenantId: string, name: string): Promise<InventoryLocation[]> {
    return await this.locationRepository.find({
      where: {
        tenantId,
        name: Like(`%${name}%`),
        isDeleted: false,
      },
      relations: ['parent'],
      order: { name: 'ASC' },
    });
  }

  /**
   * Update lokasi
   */
  async update(
    tenantId: string,
    id: string,
    updateLocationDto: UpdateInventoryLocationDto,
    userId: string,
  ): Promise<InventoryLocation> {
    const location = await this.findOne(tenantId, id);

    // Validasi kode unik jika diubah
    if (updateLocationDto.code && updateLocationDto.code !== location.code) {
      await this.validateCodeUnique(tenantId, updateLocationDto.code, id);
    }

    // Validasi parent jika diubah
    if (updateLocationDto.parentId !== undefined) {
      if (updateLocationDto.parentId) {
        await this.validateParentLocation(tenantId, updateLocationDto.parentId, id);
      }
      // Pastikan tidak membuat circular reference
      await this.validateNoCircularReference(tenantId, id, updateLocationDto.parentId);
    }

    // Validasi business rules
    if (updateLocationDto.usableArea && updateLocationDto.totalArea) {
      if (updateLocationDto.usableArea > updateLocationDto.totalArea) {
        throw new BadRequestException('Area yang bisa digunakan tidak boleh lebih besar dari total area');
      }
    }

    Object.assign(location, updateLocationDto);
    location.updatedBy = userId;

    const savedLocation = await this.locationRepository.save(location);

    // Emit real-time location update
    await this.realtimeService.emitLocationUpdate(tenantId, savedLocation);

    return savedLocation;
  }

  /**
   * Hapus lokasi (soft delete)
   */
  async remove(tenantId: string, id: string): Promise<void> {
    const location = await this.findOne(tenantId, id);

    // Cek apakah masih ada inventory items
    const inventoryCount = await this.locationRepository.manager.count('inventory_items', {
      where: { locationId: id, tenantId }
    });
    
    if (inventoryCount > 0) {
      throw new BadRequestException('Tidak dapat menghapus lokasi yang masih memiliki inventori');
    }

    // Cek apakah masih ada child locations
    if (location.children && location.children.length > 0) {
      throw new BadRequestException('Tidak dapat menghapus lokasi yang masih memiliki sub-lokasi');
    }

    location.isDeleted = true;
    location.deletedAt = new Date();

    await this.locationRepository.save(location);
  }

  /**
   * Dapatkan path hierarki lokasi
   */
  async getLocationPath(tenantId: string, locationId: string): Promise<string> {
    const location = await this.findOne(tenantId, locationId);
    const path = [location.name];

    let currentLocation = location;
    while (currentLocation.parent) {
      currentLocation = await this.findOne(tenantId, currentLocation.parent.id);
      path.unshift(currentLocation.name);
    }

    return path.join(' > ');
  }

  /**
   * Dapatkan statistik lokasi
   */
  async getLocationStats(tenantId: string, locationId?: string): Promise<{
    totalLocations: number;
    activeLocations: number;
    warehouseCount: number;
    storeCount: number;
    virtualCount: number;
    locationsWithInventory: number;
  }> {
    const whereCondition: any = { tenantId, isDeleted: false };
    if (locationId) {
      whereCondition.id = locationId;
    }

    const [
      totalLocations,
      activeLocations,
      warehouseCount,
      storeCount,
      virtualCount,
      locationsWithInventory,
    ] = await Promise.all([
      this.locationRepository.count({ where: whereCondition }),
      this.locationRepository.count({ where: { ...whereCondition, status: LocationStatus.ACTIVE } }),
      this.locationRepository.count({ where: { ...whereCondition, type: 'warehouse' } }),
      this.locationRepository.count({ where: { ...whereCondition, type: 'store' } }),
      this.locationRepository.count({ where: { ...whereCondition, type: 'virtual' } }),
      this.locationRepository
        .createQueryBuilder('location')
        .leftJoin('location.inventoryItems', 'item')
        .where('location.tenantId = :tenantId', { tenantId })
        .andWhere('location.isDeleted = false')
        .andWhere(locationId ? 'location.id = :locationId' : '1=1', { locationId })
        .groupBy('location.id')
        .having('COUNT(item.id) > 0')
        .getCount(),
    ]);

    return {
      totalLocations,
      activeLocations,
      warehouseCount,
      storeCount,
      virtualCount,
      locationsWithInventory,
    };
  }

  /**
   * Reorder lokasi untuk parent yang sama
   */
  async reorderLocations(
    tenantId: string,
    parentId: string | null,
    reorderData: Array<{ id: string; sortOrder: number }>,
  ): Promise<void> {
    // Validasi bahwa semua location adalah children dari parent yang sama
    for (const item of reorderData) {
      const location = await this.findOne(tenantId, item.id);
      if (location.parentId !== parentId) {
        throw new BadRequestException(`Lokasi ${item.id} bukan child dari parent yang ditentukan`);
      }
    }

    // TODO: Implement sort order functionality
    // Note: sortOrder field needs to be added to InventoryLocation entity first
    console.log('Location reorder requested:', reorderData);
  }

  /**
   * Pindahkan lokasi ke parent baru
   */
  async moveLocation(
    tenantId: string,
    locationId: string,
    newParentId: string | null,
    userId: string,
  ): Promise<InventoryLocation> {
    const location = await this.findOne(tenantId, locationId);

    if (newParentId) {
      await this.validateParentLocation(tenantId, newParentId, locationId);
      await this.validateNoCircularReference(tenantId, locationId, newParentId);
    }

    location.parentId = newParentId;
    location.updatedBy = userId;

    return await this.locationRepository.save(location);
  }

  // Private helper methods
  private async validateCodeUnique(tenantId: string, code: string, excludeId?: string): Promise<void> {
    const whereCondition: any = { tenantId, code, isDeleted: false };
    if (excludeId) {
      whereCondition.id = Not(excludeId);
    }

    const existingLocation = await this.locationRepository.findOne({ where: whereCondition });
    if (existingLocation) {
      throw new ConflictException(`Kode lokasi "${code}" sudah digunakan`);
    }
  }

  private async validateParentLocation(tenantId: string, parentId: string, excludeId?: string): Promise<void> {
    const parent = await this.locationRepository.findOne({
      where: { id: parentId, tenantId, isDeleted: false },
    });

    if (!parent) {
      throw new NotFoundException('Parent lokasi tidak ditemukan');
    }

    if (excludeId && parent.id === excludeId) {
      throw new BadRequestException('Lokasi tidak bisa menjadi parent dari dirinya sendiri');
    }
  }

  private async validateNoCircularReference(
    tenantId: string,
    locationId: string,
    newParentId: string | null,
  ): Promise<void> {
    if (!newParentId) return;

    // Cek apakah newParent adalah descendant dari location
    const descendants = await this.getAllDescendants(tenantId, locationId);
    const descendantIds = descendants.map(d => d.id);

    if (descendantIds.includes(newParentId)) {
      throw new BadRequestException('Tidak dapat membuat circular reference dalam hierarki lokasi');
    }
  }

  private async getAllDescendants(tenantId: string, locationId: string): Promise<InventoryLocation[]> {
    const children = await this.locationRepository.find({
      where: { parentId: locationId, tenantId, isDeleted: false },
    });

    let allDescendants = [...children];

    for (const child of children) {
      const grandChildren = await this.getAllDescendants(tenantId, child.id);
      allDescendants = allDescendants.concat(grandChildren);
    }

    return allDescendants;
  }

  private validateBusinessRules(createLocationDto: CreateInventoryLocationDto): void {
    // Validasi area
    if (createLocationDto.usableArea && createLocationDto.totalArea) {
      if (createLocationDto.usableArea > createLocationDto.totalArea) {
        throw new BadRequestException('Area yang bisa digunakan tidak boleh lebih besar dari total area');
      }
    }

    // Validasi koordinat
    if (createLocationDto.latitude !== undefined && (createLocationDto.latitude < -90 || createLocationDto.latitude > 90)) {
      throw new BadRequestException('Latitude harus antara -90 dan 90');
    }

    if (createLocationDto.longitude !== undefined && (createLocationDto.longitude < -180 || createLocationDto.longitude > 180)) {
      throw new BadRequestException('Longitude harus antara -180 dan 180');
    }
  }
}