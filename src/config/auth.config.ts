import { registerAs } from '@nestjs/config';

export const authConfig = registerAs('auth', () => ({
  jwtSecret: process.env.JWT_SECRET || 'stokcerdas-super-secret-key-change-in-production',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'stokcerdas-refresh-secret-key-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '15m',
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10) || 12,
  mfaEnabled: process.env.MFA_ENABLED === 'true' || false,
  sessionSecret: process.env.SESSION_SECRET || 'stokcerdas-session-secret-change-in-production',
  maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS, 10) || 5,
  lockoutTime: parseInt(process.env.LOCKOUT_TIME, 10) || 300000, // 5 minutes
}));