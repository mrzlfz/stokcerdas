import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User, UserRole, UserStatus } from '../../users/entities/user.entity';
import { ProductCategory } from '../../products/entities/product-category.entity';
import {
  InventoryLocation,
  LocationType,
  LocationStatus,
} from '../../inventory/entities/inventory-location.entity';

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

    const adminUser = new User();
    (adminUser as any).tenantId = testTenantId;
    adminUser.email = 'admin@stokcerdas.test';
    adminUser.password = hashedPassword;
    adminUser.firstName = 'Admin';
    adminUser.lastName = 'User';
    adminUser.role = UserRole.ADMIN;
    adminUser.status = UserStatus.ACTIVE;
    adminUser.emailVerified = true;
    adminUser.language = 'id';
    adminUser.timezone = 'Asia/Jakarta';

    const savedAdminUser = await userRepository.save(adminUser);
    console.log('✅ Created admin user: admin@stokcerdas.test');

    // Create test staff user
    const staffUser = new User();
    (staffUser as any).tenantId = testTenantId;
    staffUser.email = 'staff@stokcerdas.test';
    staffUser.password = hashedPassword;
    staffUser.firstName = 'Staff';
    staffUser.lastName = 'User';
    staffUser.role = UserRole.STAFF;
    staffUser.status = UserStatus.ACTIVE;
    staffUser.emailVerified = true;
    staffUser.language = 'id';
    staffUser.timezone = 'Asia/Jakarta';
    (staffUser as any).createdBy = (savedAdminUser as any).id;

    const savedStaffUser = await userRepository.save(staffUser);
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
      const category = new ProductCategory();
      (category as any).tenantId = testTenantId;
      category.name = categoryData.name;
      category.description = categoryData.description;
      (category as any).createdBy = (savedAdminUser as any).id;

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
        totalArea: 1500.0,
        usableArea: 1200.0,
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
        totalArea: 200.0,
        usableArea: 150.0,
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
        totalArea: 1000.0,
        usableArea: 800.0,
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
      const location = new InventoryLocation();
      (location as any).tenantId = testTenantId;
      (location as any).createdBy = (savedAdminUser as any).id;

      // Assign all location properties
      Object.assign(location, locationData);

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
