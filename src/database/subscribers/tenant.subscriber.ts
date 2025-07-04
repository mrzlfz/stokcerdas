import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  LoadEvent,
} from 'typeorm';
import { BaseEntity } from '../../common/entities/base.entity';

/**
 * Tenant Subscriber untuk otomatis menambahkan tenant_id
 * 
 * NOTE: Saat ini subscriber ini tidak aktif karena tenant_id
 * dihandle secara eksplisit di service layer untuk keamanan yang lebih baik.
 * 
 * Jika ingin mengaktifkan kembali, tambahkan ke subscribers di app.module.ts
 */
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  // Mendengarkan semua entity yang extend BaseEntity
  listenTo() {
    return BaseEntity;
  }

  // Auto-inject tenant ID on insert (currently disabled)
  beforeInsert(event: InsertEvent<any>) {
    // Tenant ID harus diset secara eksplisit di service layer
    // untuk menghindari security issues
    
    // if (event.entity instanceof BaseEntity) {
    //   const tenantId = this.getTenantIdFromContext(event);
    //   if (tenantId && !event.entity.tenantId) {
    //     event.entity.tenantId = tenantId;
    //   }
    // }
  }

  // Auto-inject tenant ID on update (currently disabled)
  beforeUpdate(event: UpdateEvent<any>) {
    // Tenant ID harus diset secara eksplisit di service layer
    // untuk menghindari security issues
    
    // if (event.entity instanceof BaseEntity) {
    //   const tenantId = this.getTenantIdFromContext(event);
    //   if (tenantId && !event.entity.tenantId) {
    //     event.entity.tenantId = tenantId;
    //   }
    // }
  }

  // Add tenant filter to all SELECT queries
  afterLoad(entity: any, event?: LoadEvent<any>) {
    // This is handled by repository-level filtering
    // but could be used for additional validation
  }

  private getTenantIdFromContext(event: any): string | null {
    // TypeORM subscribers tidak memiliki akses ke request context
    // Tenant ID harus dihandle di service layer
    return null;
  }
}
