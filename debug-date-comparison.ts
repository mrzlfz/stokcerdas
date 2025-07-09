import * as moment from 'moment-timezone';
import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

const jakartaTz = 'Asia/Jakarta';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('=== DEBUGGING DATE COMPARISON ISSUES ===\n');

// Test current problematic approach
console.log('1. Current test approach (timezone-aware moment):');
const momentDate = moment.tz('2025-02-28', jakartaTz).toDate();
console.log('   moment.tz("2025-02-28", jakartaTz).toDate():', momentDate);
console.log('   ISO:', momentDate.toISOString());
console.log('   Service result:', service.isRamadanPeriod(momentDate));

console.log('\n2. Direct Date creation:');
const directDate = new Date('2025-02-28');
console.log('   new Date("2025-02-28"):', directDate);
console.log('   ISO:', directDate.toISOString());
console.log('   Service result:', service.isRamadanPeriod(directDate));

console.log('\n3. ISO Date creation:');
const isoDate = new Date('2025-02-28T00:00:00.000Z');
console.log('   new Date("2025-02-28T00:00:00.000Z"):', isoDate);
console.log('   ISO:', isoDate.toISOString());
console.log('   Service result:', service.isRamadanPeriod(isoDate));

console.log('\n4. Testing service internal logic:');
const testYear = 2025;
const ramadanConfig = { start: '2025-02-28', end: '2025-03-29' };
const configStartDate = new Date(ramadanConfig.start);
const configEndDate = new Date(ramadanConfig.end);
console.log('   Config start date:', configStartDate);
console.log('   Config start ISO:', configStartDate.toISOString());
console.log('   Config end date:', configEndDate);
console.log('   Config end ISO:', configEndDate.toISOString());

console.log('\n5. Comparison results:');
console.log('   momentDate >= configStartDate:', momentDate >= configStartDate);
console.log('   momentDate <= configEndDate:', momentDate <= configEndDate);
console.log('   directDate >= configStartDate:', directDate >= configStartDate);
console.log('   directDate <= configEndDate:', directDate <= configEndDate);

console.log('\n6. Testing with Jakarta local date creation:');
const jakartaLocalDate = moment.tz('2025-02-28', jakartaTz).utc().toDate();
console.log('   Jakarta local to UTC:', jakartaLocalDate);
console.log('   ISO:', jakartaLocalDate.toISOString());
console.log('   Service result:', service.isRamadanPeriod(jakartaLocalDate));

console.log('\n7. Testing with proper date approach:');
const properDate = new Date('2025-02-28T07:00:00.000Z'); // Adding 7 hours for Jakarta offset
console.log('   Proper UTC date:', properDate);
console.log('   ISO:', properDate.toISOString());
console.log('   Service result:', service.isRamadanPeriod(properDate));