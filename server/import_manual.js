const WordleDatabase = require('./database');

// Initialize database
const db = new WordleDatabase();

// Example Wordle share message
// You can replace this string with your own data
const message = `Wordle 1000 4/6

1/6: @user1
2/6: @user2
3/6: @user3
4/6: @user4`;

try {
    console.log('Importing data...');
    const result = db.addStreakData(message);
    console.log('Success!', result);
} catch (error) {
    console.error('Error importing data:', error.message);
} finally {
    db.close();
}
