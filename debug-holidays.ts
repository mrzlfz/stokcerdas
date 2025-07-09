import { IndonesianBusinessCalendarService } from './src/ml-forecasting/services/indonesian-business-calendar.service';

// Mock the cache manager
const mockCacheManager = {
  get: () => Promise.resolve(null),
  set: () => Promise.resolve(),
};

const service = new IndonesianBusinessCalendarService(mockCacheManager as any);

console.log('=== DEBUGGING HOLIDAY EFFECT MULTIPLIERS ===\n');

// Test dates from the failing tests
const kemerdekaan = new Date('2025-08-17');
const natal = new Date('2025-12-25');

console.log('1. Testing date string conversion:');
console.log('   kemerdekaan date:', kemerdekaan);
console.log('   kemerdekaan ISO:', kemerdekaan.toISOString());
console.log('   kemerdekaan dateStr:', kemerdekaan.toISOString().split('T')[0]);

console.log('\n2. Testing holiday lookup:');
const kemerdekaanDateStr = kemerdekaan.toISOString().split('T')[0];
const natalDateStr = natal.toISOString().split('T')[0];

console.log('   Looking for kemerdekaan:', kemerdekaanDateStr);
console.log('   Looking for natal:', natalDateStr);

console.log('\n3. Testing getHolidayInfo method:');
service.getHolidayInfo(kemerdekaan).then(kemerdekaanInfo => {
  console.log('   kemerdekaan info:', kemerdekaanInfo);
  
  service.getHolidayInfo(natal).then(natalInfo => {
    console.log('   natal info:', natalInfo);
    
    console.log('\n4. Testing isPublicHoliday method:');
    console.log('   kemerdekaan isPublicHoliday:', service.isPublicHoliday(kemerdekaan));
    console.log('   natal isPublicHoliday:', service.isPublicHoliday(natal));

    console.log('\n5. Testing getHolidayEffectMultiplier:');
    const kemerdekaanEffect = service.getHolidayEffectMultiplier(kemerdekaan, 'food');
    const natalEffect = service.getHolidayEffectMultiplier(natal, 'food');

    console.log('   kemerdekaan effect (food):', kemerdekaanEffect);
    console.log('   natal effect (food):', natalEffect);

    console.log('\n6. Testing with different categories:');
    console.log('   kemerdekaan effect (gifts):', service.getHolidayEffectMultiplier(kemerdekaan, 'gifts'));
    console.log('   natal effect (gifts):', service.getHolidayEffectMultiplier(natal, 'gifts'));

    console.log('\n7. Testing regional holidays:');
    const jakartaHoliday = new Date('2025-06-22');
    const jakartaInfo = service.getRegionalHolidayInfo(jakartaHoliday, 'jakarta');
    console.log('   Jakarta holiday info:', jakartaInfo);
  });
});

