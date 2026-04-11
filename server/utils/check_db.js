const Database = require('better-sqlite3');

console.log('Checking wordle_database.db:');
const db1 = new Database('./data/wordle_database.db');
const users1 = db1.prepare('SELECT COUNT(*) as count FROM users').get();
const days1 = db1.prepare('SELECT COUNT(*) as count FROM streaks').get();
const results1 = db1.prepare('SELECT COUNT(*) as count FROM results').get();
console.log(`  Users: ${users1.count}, Days: ${days1.count}, Results: ${results1.count}`);

// Show some sample data
const sampleUsers = db1.prepare('SELECT * FROM users LIMIT 10').all();
console.log('\nSample users:');
sampleUsers.forEach(u => console.log(`  - ${u.username} (ID: ${u.id})`));

const sampleDays = db1.prepare('SELECT * FROM streaks ORDER BY day DESC LIMIT 5').all();
console.log('\nRecent days:');
sampleDays.forEach(d => console.log(`  - Day ${d.day} (${d.date})`));

db1.close();

console.log('\n---\n');

console.log('Checking wordle.db:');
const db2 = new Database('./data/wordle.db');
const users2 = db2.prepare('SELECT COUNT(*) as count FROM users').get();
const days2 = db2.prepare('SELECT COUNT(*) as count FROM streaks').get();
const results2 = db2.prepare('SELECT COUNT(*) as count FROM results').get();
console.log(`  Users: ${users2.count}, Days: ${days2.count}, Results: ${results2.count}`);
db2.close();
