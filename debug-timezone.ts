import * as moment from 'moment-timezone';
import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('=== DEBUGGING TIMEZONE CONVERSION ===\n');

// Test timezone conversion
const jakartaTime = moment.tz('2025-06-15 14:00:00', 'Asia/Jakarta');
console.log('Original Jakarta time:', jakartaTime.format());
console.log('Jakarta time as Date:', jakartaTime.toDate());
console.log('Jakarta time hour:', jakartaTime.hour());

const makassarTime = service.convertTimezone(jakartaTime.toDate(), 'wib', 'wita');
const jayapuraTime = service.convertTimezone(jakartaTime.toDate(), 'wib', 'wit');

console.log('\nConverted times:');
console.log('Makassar time:', makassarTime);
console.log('Jayapura time:', jayapuraTime);

// Test the hour values
console.log('\nTesting hour values:');
console.log('Original Jakarta hour:', jakartaTime.hour());
console.log('Makassar moment hour:', moment.tz(makassarTime, 'Asia/Makassar').hour());
console.log('Jayapura moment hour:', moment.tz(jayapuraTime, 'Asia/Jayapura').hour());

// Test business hours optimization
console.log('\nTesting business hours optimization:');
const morningTime = new Date('2025-06-15T02:00:00Z'); // 9 AM Jakarta
const eveningTime = new Date('2025-06-15T10:00:00Z'); // 5 PM Jakarta  
const nightTime = new Date('2025-06-15T15:00:00Z'); // 10 PM Jakarta

console.log('Morning time:', morningTime);
console.log('Evening time:', eveningTime);
console.log('Night time:', nightTime);

const morningOptimized = service.optimizeForBusinessHours(morningTime, 'wib');
const eveningOptimized = service.optimizeForBusinessHours(eveningTime, 'wib');
const nightOptimized = service.optimizeForBusinessHours(nightTime, 'wib');

console.log('Morning optimized:', morningOptimized);
console.log('Evening optimized:', eveningOptimized);
console.log('Night optimized:', nightOptimized);

// Test business hours checking
console.log('\nTesting business hours checking:');
console.log('Morning isBusinessHours:', service.isBusinessHours(morningTime, 'wib'));
console.log('Evening isBusinessHours:', service.isBusinessHours(eveningTime, 'wib'));
console.log('Night isBusinessHours:', service.isBusinessHours(nightTime, 'wib'));