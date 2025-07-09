import { IndonesianBusinessCalendarHelper } from './src/config/indonesian-business-calendar.config';

console.log('Testing Ramadan dates...');
const ramadanDates = IndonesianBusinessCalendarHelper.getRamadanDates(2025);
console.log('Ramadan dates for 2025:', ramadanDates);
console.log('Testing isRamadanPeriod with 2025-02-28:', IndonesianBusinessCalendarHelper.isRamadanPeriod('2025-02-28'));
console.log('Testing isRamadanPeriod with 2025-03-10:', IndonesianBusinessCalendarHelper.isRamadanPeriod('2025-03-10'));
console.log('Testing isRamadanPeriod with 2025-02-15:', IndonesianBusinessCalendarHelper.isRamadanPeriod('2025-02-15'));