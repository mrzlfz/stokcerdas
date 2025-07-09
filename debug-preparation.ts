import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('=== DEBUGGING HOLIDAY PREPARATION PERIODS ===\n');

// Test the preparation period logic
const beforeKemerdekaan = new Date('2025-08-10'); // Week before
const beforeNatal = new Date('2025-12-18'); // Week before

console.log('1. Testing holiday preparation periods:');
console.log('   beforeKemerdekaan:', beforeKemerdekaan.toISOString());
console.log('   beforeNatal:', beforeNatal.toISOString());

const kemerdekaanPrep = service.isHolidayPreparationPeriod(beforeKemerdekaan);
const natalPrep = service.isHolidayPreparationPeriod(beforeNatal);

console.log('   kemerdekaanPrep result:', kemerdekaanPrep);
console.log('   natalPrep result:', natalPrep);

// Debug: Test the holiday effect multipliers during preparation
console.log('\n2. Testing holiday effect multipliers during preparation:');
const natalPrep1Week = new Date('2025-12-18');
const natalPrep3Days = new Date('2025-12-22');
const natalDay = new Date('2025-12-25');

const effect1Week = service.getHolidayEffectMultiplier(natalPrep1Week, 'gifts');
const effect3Days = service.getHolidayEffectMultiplier(natalPrep3Days, 'gifts');
const effectDay = service.getHolidayEffectMultiplier(natalDay, 'gifts');

console.log('   effect1Week:', effect1Week);
console.log('   effect3Days:', effect3Days);
console.log('   effectDay:', effectDay);

// Test if these dates are actual holidays
console.log('\n3. Testing if preparation dates are holidays:');
console.log('   natalPrep1Week isPublicHoliday:', service.isPublicHoliday(natalPrep1Week));
console.log('   natalPrep3Days isPublicHoliday:', service.isPublicHoliday(natalPrep3Days));
console.log('   natalDay isPublicHoliday:', service.isPublicHoliday(natalDay));

// Test the next business day feature
console.log('\n4. Testing next business day:');
const friday = new Date('2025-01-03'); // Friday
const saturday = new Date('2025-01-04'); // Saturday
const sunday = new Date('2025-01-05'); // Sunday

console.log('   friday next business day:', service.getNextBusinessDay(friday));
console.log('   saturday next business day:', service.getNextBusinessDay(saturday));
console.log('   sunday next business day:', service.getNextBusinessDay(sunday));