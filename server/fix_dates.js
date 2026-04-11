const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, '../data/wordle_database.db');
const db = new Database(dbPath);

console.log('Fixing first_seen dates...');

// Get all users
const users = db.prepare('SELECT id, username, first_seen FROM users').all();
let updatedCount = 0;

const updateStmt = db.prepare('UPDATE users SET first_seen = ? WHERE id = ?');

const transaction = db.transaction(() => {
    for (const user of users) {
        // Find earliest game date for this user
        const result = db.prepare(`
            SELECT MIN(s.date) as first_game_date
            FROM results r
            JOIN streaks s ON r.streak_day = s.day
            WHERE r.user_id = ?
        `).get(user.id);

        if (result && result.first_game_date) {
            // Only update if the current first_seen is newer than the first game date,
            // or if we just want to enforce accurate history. 
            // The current first_seen is likely an import timestamp (2025-08-30...).
            // The first_game_date is YYYY-MM-DD.
            // Let's just set it to the first_game_date.

            // Note: first_seen is currently "YYYY-MM-DD HH:MM:SS" (string).
            // first_game_date is "YYYY-MM-DD" (string).
            // This is effectively casting it to just the date, which is cleaner anyway.

            if (user.first_seen !== result.first_game_date) {
                updateStmt.run(result.first_game_date, user.id);
                updatedCount++;
            }
        }
    }
});

transaction();

console.log(`Updated ${updatedCount} users.`);
db.close();
