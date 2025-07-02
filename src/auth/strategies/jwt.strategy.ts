import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';

import { User, UserStatus } from '../../users/entities/user.entity';
import { JwtPayload } from '../services/auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly configService: ConfigService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('auth.jwt.secret'),
      issuer: configService.get<string>('auth.jwt.issuer'),
      audience: configService.get<string>('auth.jwt.audience'),
    });
  }

  async validate(payload: JwtPayload): Promise<User> {
    const { sub: userId, tenantId } = payload;

    // Find user with tenant validation
    const user = await this.userRepository.findOne({
      where: {
        id: userId,
        tenantId,
        isDeleted: false,
      },
      select: [
        'id',
        'tenantId',
        'email',
        'firstName',
        'lastName',
        'role',
        'status',
        'emailVerified',
        'mfaEnabled',
        'lastLoginAt',
      ],
    });

    if (!user) {
      throw new UnauthorizedException('Token tidak valid - pengguna tidak ditemukan');
    }

    // Check if user is active
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException('Akun tidak aktif');
    }

    // Check if email is verified
    if (!user.emailVerified) {
      throw new UnauthorizedException('Email belum diverifikasi');
    }

    // Check if account is locked
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException('Akun terkunci sementara');
    }

    return user;
  }
}