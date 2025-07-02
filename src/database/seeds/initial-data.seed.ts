import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { ProductCategory } from '../../products/entities/product.entity';
import { InventoryLocation, LocationType, LocationStatus } from '../../inventory/entities/inventory-location.entity';

export class InitialDataSeed {
  static async run(dataSource: DataSource): Promise<void> {
    console.log('🌱 Running initial data seed...');

    const userRepository = dataSource.getRepository(User);
    const categoryRepository = dataSource.getRepository(ProductCategory);
    const locationRepository = dataSource.getRepository(InventoryLocation);

    // Test tenant ID
    const testTenantId = '00000000-0000-4000-8000-000000000001';

    // Create test admin user
    const hashedPassword = await bcrypt.hash('admin123', 12);
    
    const adminUser = userRepository.create({
      tenantId: testTenantId,
      email: 'admin@stokcerdas.test',
      password: hashedPassword,
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      language: 'id',
      timezone: 'Asia/Jakarta',
    });

    await userRepository.save(adminUser);
    console.log('✅ Created admin user: admin@stokcerdas.test');

    // Create test staff user
    const staffUser = userRepository.create({
      tenantId: testTenantId,
      email: 'staff@stokcerdas.test',
      password: hashedPassword,
      firstName: 'Staff',
      lastName: 'User',
      role: UserRole.STAFF,
      status: UserStatus.ACTIVE,
      emailVerified: true,
      language: 'id',
      timezone: 'Asia/Jakarta',
      createdBy: adminUser.id,
    });

    await userRepository.save(staffUser);
    console.log('✅ Created staff user: staff@stokcerdas.test');

    // Create product categories
    const categories = [
      {
        name: 'Elektronik',
        description: 'Produk elektronik dan gadget',
      },
      {
        name: 'Pakaian',
        description: 'Pakaian dan aksesoris fashion',
      },
      {
        name: 'Makanan & Minuman',
        description: 'Produk makanan dan minuman',
      },
      {
        name: 'Kesehatan & Kecantikan',
        description: 'Produk kesehatan dan kecantikan',
      },
      {
        name: 'Rumah Tangga',
        description: 'Peralatan dan kebutuhan rumah tangga',
      },
    ];

    for (const categoryData of categories) {
      const category = categoryRepository.create({
        tenantId: testTenantId,
        ...categoryData,
        createdBy: adminUser.id,
      });

      await categoryRepository.save(category);
      console.log(`✅ Created category: ${category.name}`);
    }

    // Create inventory locations
    const locations = [
      {
        code: 'WH001',
        name: 'Gudang Utama Jakarta',
        description: 'Gudang utama di Jakarta Selatan',
        type: LocationType.WAREHOUSE,
        status: LocationStatus.ACTIVE,
        address: 'Jl. Raya Pasar Minggu No. 123',
        city: 'Jakarta Selatan',
        state: 'DKI Jakarta',
        postalCode: '12560',
        country: 'Indonesia',
        phoneNumber: '+62-21-12345678',
        email: 'warehouse.jakarta@stokcerdas.com',
        contactPerson: 'Budi Santoso',
        totalArea: 1500.00,
        usableArea: 1200.00,
        maxCapacity: 10000,
        isPickupLocation: true,
        isDropoffLocation: true,
        allowNegativeStock: false,
      },
      {
        code: 'ST001',
        name: 'Toko Jakarta Pusat',
        description: 'Toko retail di Jakarta Pusat',
        type: LocationType.STORE,
        status: LocationStatus.ACTIVE,
        address: 'Jl. Thamrin No. 456',
        city: 'Jakarta Pusat',
        state: 'DKI Jakarta',
        postalCode: '10350',
        country: 'Indonesia',
        phoneNumber: '+62-21-87654321',
        email: 'store.thamrin@stokcerdas.com',
        contactPerson: 'Sari Dewi',
        totalArea: 200.00,
        usableArea: 150.00,
        maxCapacity: 1000,
        isPickupLocation: true,
        isDropoffLocation: false,
        allowNegativeStock: true,
        operatingHours: {
          monday: { open: '09:00', close: '21:00' },
          tuesday: { open: '09:00', close: '21:00' },
          wednesday: { open: '09:00', close: '21:00' },
          thursday: { open: '09:00', close: '21:00' },
          friday: { open: '09:00', close: '21:00' },
          saturday: { open: '10:00', close: '22:00' },
          sunday: { open: '10:00', close: '20:00' },
        },
      },
      {
        code: 'WH002',
        name: 'Gudang Surabaya',
        description: 'Gudang cabang di Surabaya',
        type: LocationType.WAREHOUSE,
        status: LocationStatus.ACTIVE,
        address: 'Jl. Ahmad Yani No. 789',
        city: 'Surabaya',
        state: 'Jawa Timur',
        postalCode: '60234',
        country: 'Indonesia',
        phoneNumber: '+62-31-11223344',
        email: 'warehouse.surabaya@stokcerdas.com',
        contactPerson: 'Agus Prasetyo',
        totalArea: 1000.00,
        usableArea: 800.00,
        maxCapacity: 7500,
        isPickupLocation: true,
        isDropoffLocation: true,
        allowNegativeStock: false,
      },
      {
        code: 'VRT001',
        name: 'Virtual - Online Store',
        description: 'Virtual location for online sales',
        type: LocationType.VIRTUAL,
        status: LocationStatus.ACTIVE,
        maxCapacity: 999999,
        isPickupLocation: false,
        isDropoffLocation: false,
        allowNegativeStock: true,
      },
    ];

    for (const locationData of locations) {
      const location = locationRepository.create({
        tenantId: testTenantId,
        ...locationData,
        createdBy: adminUser.id,
      });

      await locationRepository.save(location);
      console.log(`✅ Created location: ${location.name}`);
    }

    console.log('🎉 Initial data seed completed successfully!');
    console.log('');
    console.log('📝 Test Credentials:');
    console.log('Admin: admin@stokcerdas.test / admin123');
    console.log('Staff: staff@stokcerdas.test / admin123');
    console.log(`Tenant ID: ${testTenantId}`);
  }
}