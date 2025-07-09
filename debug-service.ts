import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('Testing service methods...');

const ramadanStart = new Date('2025-02-28');
const ramadanEnd = new Date('2025-03-29');
const normalDay = new Date('2025-02-15');

console.log('Ramadan start date:', ramadanStart);
console.log('Ramadan end date:', ramadanEnd);
console.log('Normal day:', normalDay);

console.log('isRamadanPeriod with ramadanStart:', service.isRamadanPeriod(ramadanStart));
console.log('isRamadanPeriod with ramadanEnd:', service.isRamadanPeriod(ramadanEnd));
console.log('isRamadanPeriod with normalDay:', service.isRamadanPeriod(normalDay));

const lebaranStart = new Date('2025-03-30');
const lebaranEnd = new Date('2025-04-05');

console.log('isLebaranPeriod with lebaranStart:', service.isLebaranPeriod(lebaranStart));
console.log('isLebaranPeriod with lebaranEnd:', service.isLebaranPeriod(lebaranEnd));