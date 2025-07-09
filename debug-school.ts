import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('=== DEBUGGING SCHOOL-RELATED DEMAND MULTIPLIERS ===\n');

// Test the school-related demand multipliers
const backToSchoolDate = new Date('2025-07-15'); // Mid-year break end
const examPeriodDate = new Date('2025-12-05'); // Exam period

console.log('1. Testing dates:');
console.log('   backToSchoolDate:', backToSchoolDate.toISOString());
console.log('   examPeriodDate:', examPeriodDate.toISOString());

console.log('\n2. Testing school holiday check:');
console.log('   backToSchoolDate isSchoolHoliday:', service.isSchoolHoliday(backToSchoolDate));
console.log('   examPeriodDate isSchoolHoliday:', service.isSchoolHoliday(examPeriodDate));

console.log('\n3. Testing school-related demand multipliers:');
const schoolSuppliesEffect = service.getSchoolRelatedEffectMultiplier(
  backToSchoolDate,
  'school_supplies'
);
const examSuppliesEffect = service.getSchoolRelatedEffectMultiplier(
  examPeriodDate,
  'stationery'
);

console.log('   schoolSuppliesEffect:', schoolSuppliesEffect);
console.log('   examSuppliesEffect:', examSuppliesEffect);

// Test different product types
console.log('\n4. Testing different product types:');
console.log('   uniforms:', service.getSchoolRelatedEffectMultiplier(backToSchoolDate, 'uniforms'));
console.log('   books:', service.getSchoolRelatedEffectMultiplier(backToSchoolDate, 'books'));
console.log('   stationery for back to school:', service.getSchoolRelatedEffectMultiplier(backToSchoolDate, 'stationery'));

// Test the internal logic
console.log('\n5. Testing internal logic:');
const testDate = new Date('2025-07-15');
console.log('   Month:', testDate.getMonth() + 1); // JavaScript months are 0-based
console.log('   Day:', testDate.getDate());
console.log('   Is back to school period?', testDate.getMonth() + 1 === 7 && testDate.getDate() > 15);

// Test exam period
const examDate = new Date('2025-12-05');
console.log('   Exam date month:', examDate.getMonth() + 1);
console.log('   Exam date day:', examDate.getDate());
console.log('   Is exam period?', examDate.getMonth() + 1 === 12 && examDate.getDate() < 15);