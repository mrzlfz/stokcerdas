import {
  EventSubscriber,
  EntitySubscriberInterface,
  InsertEvent,
  UpdateEvent,
  RemoveEvent,
  LoadEvent,
} from 'typeorm';
import { Injectable, Scope } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Request } from 'express';
import { BaseEntity } from '../../common/entities/base.entity';

@Injectable({ scope: Scope.REQUEST })
@EventSubscriber()
export class TenantSubscriber implements EntitySubscriberInterface {
  constructor(private readonly request: Request) {}

  // Auto-inject tenant ID on insert
  beforeInsert(event: InsertEvent<any>) {
    if (event.entity instanceof BaseEntity) {
      const tenantId = this.getTenantIdFromRequest();
      if (tenantId && !event.entity.tenantId) {
        event.entity.tenantId = tenantId;
      }
    }
  }

  // Auto-inject tenant ID on update
  beforeUpdate(event: UpdateEvent<any>) {
    if (event.entity instanceof BaseEntity) {
      const tenantId = this.getTenantIdFromRequest();
      if (tenantId && !event.entity.tenantId) {
        event.entity.tenantId = tenantId;
      }
    }
  }

  // Add tenant filter to all SELECT queries
  afterLoad(entity: any, event?: LoadEvent<any>) {
    // This is handled by repository-level filtering
    // but could be used for additional validation
  }

  private getTenantIdFromRequest(): string | null {
    try {
      return (this.request as any)?.tenantId || null;
    } catch {
      return null;
    }
  }
}