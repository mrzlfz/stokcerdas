import * as moment from 'moment-timezone';

const jakartaTz = 'Asia/Jakarta';

console.log('Testing moment.tz behavior...');

const ramadanStart = moment.tz('2025-02-28', jakartaTz);
const ramadanEnd = moment.tz('2025-03-29', jakartaTz);
const normalDay = moment.tz('2025-02-15', jakartaTz);

console.log('Ramadan start moment:', ramadanStart.format());
console.log('Ramadan start date:', ramadanStart.toDate());
console.log('Ramadan start date ISO:', ramadanStart.toDate().toISOString());
console.log('Ramadan start date year:', ramadanStart.toDate().getFullYear());

console.log('Ramadan end moment:', ramadanEnd.format());
console.log('Ramadan end date:', ramadanEnd.toDate());
console.log('Ramadan end date ISO:', ramadanEnd.toDate().toISOString());

console.log('Normal day moment:', normalDay.format());
console.log('Normal day date:', normalDay.toDate());
console.log('Normal day date ISO:', normalDay.toDate().toISOString());

// Test direct Date creation
const directRamadanStart = new Date('2025-02-28');
console.log('Direct Ramadan start:', directRamadanStart);
console.log('Direct Ramadan start ISO:', directRamadanStart.toISOString());

// Test ISO string
const isoRamadanStart = new Date('2025-02-28T00:00:00.000Z');
console.log('ISO Ramadan start:', isoRamadanStart);
console.log('ISO Ramadan start ISO:', isoRamadanStart.toISOString());