import { Entity, Column, Index, OneToMany } from 'typeorm';
import { Exclude } from 'class-transformer';
import { AuditableEntity } from '../../common/entities/base.entity';

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ADMIN = 'admin',
  MANAGER = 'manager',
  STAFF = 'staff',
  CONFIG_MANAGER = 'config_manager',
  AUDITOR = 'auditor',
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  PENDING = 'pending',
}

@Entity('users')
@Index(['tenantId', 'email'], { unique: true })
@Index(['tenantId', 'isDeleted'])
export class User extends AuditableEntity {
  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 255 })
  @Exclude()
  password: string;

  @Column({ type: 'varchar', length: 100 })
  firstName: string;

  @Column({ type: 'varchar', length: 100 })
  lastName: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  phoneNumber?: string;

  @Column({
    type: 'enum',
    enum: UserRole,
    default: UserRole.STAFF,
  })
  role: UserRole;

  @Column({
    type: 'enum',
    enum: UserStatus,
    default: UserStatus.PENDING,
  })
  status: UserStatus;

  @Column({ type: 'varchar', length: 255, nullable: true })
  avatar?: string;

  @Column({ type: 'varchar', length: 10, default: 'id' })
  language: string;

  @Column({ type: 'varchar', length: 50, default: 'Asia/Jakarta' })
  timezone: string;

  @Column({ type: 'timestamp', nullable: true })
  lastLoginAt?: Date;

  @Column({ type: 'inet', nullable: true })
  @Exclude()
  lastLoginIp?: string;

  @Column({ type: 'int', default: 0 })
  @Exclude()
  loginAttempts: number;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  lockedUntil?: Date;

  @Column({ type: 'boolean', default: false })
  emailVerified: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  emailVerificationToken?: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  resetPasswordToken?: string;

  @Column({ type: 'timestamp', nullable: true })
  @Exclude()
  resetPasswordExpires?: Date;

  @Column({ type: 'boolean', default: false })
  mfaEnabled: boolean;

  @Column({ type: 'varchar', length: 255, nullable: true })
  @Exclude()
  mfaSecret?: string;

  @Column({ type: 'jsonb', nullable: true })
  preferences?: Record<string, any>;

  // Virtual field for full name
  get fullName(): string {
    return `${this.firstName} ${this.lastName}`.trim();
  }

  // Check if user is locked
  get isLocked(): boolean {
    return !!(this.lockedUntil && this.lockedUntil > new Date());
  }

  // Check if user can login
  get canLogin(): boolean {
    return (
      this.status === UserStatus.ACTIVE && !this.isLocked && !this.isDeleted
    );
  }

  // Increment login attempts
  incLoginAttempts(): void {
    this.loginAttempts += 1;

    // Lock user after 5 failed attempts for 15 minutes
    if (this.loginAttempts >= 5) {
      this.lockedUntil = new Date(Date.now() + 15 * 60 * 1000);
    }
  }

  // Reset login attempts
  resetLoginAttempts(): void {
    this.loginAttempts = 0;
    this.lockedUntil = null;
  }

  // Update last login
  updateLastLogin(ip?: string): void {
    this.lastLoginAt = new Date();
    this.lastLoginIp = ip;
    this.resetLoginAttempts();
  }
}
