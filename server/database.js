const Database = require('better-sqlite3');
const path = require('path');
const { parseMessage } = require('./utils/parser');

class WordleDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || process.env.DATABASE_PATH || path.join(__dirname, '../data/wordle.db');
        this.db = null;
        this.initDatabase();
    }

    initDatabase() {
        this.db = new Database(this.dbPath);
        
        // Create users table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create streaks table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS streaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day INTEGER UNIQUE NOT NULL,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create results table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                streak_day INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                score TEXT NOT NULL,
                is_winner BOOLEAN DEFAULT 0,
                FOREIGN KEY (streak_day) REFERENCES streaks (day),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(streak_day, user_id)
            )
        `);
    }

    addUser(username) {
        const insert = this.db.prepare('INSERT OR IGNORE INTO users (username) VALUES (?)');
        insert.run(username);
        
        const select = this.db.prepare('SELECT id FROM users WHERE username = ?');
        const user = select.get(username);
        return user.id;
    }

    addStreakData(message) {
        try {
            const parsed = parseMessage(message);
            const streakDay = parsed.day;

            // Start transaction
            const transaction = this.db.transaction((data) => {
                // Add streak day
                const insertStreak = this.db.prepare('INSERT OR IGNORE INTO streaks (day) VALUES (?)');
                insertStreak.run(data.day);

                // Add results
                const insertResult = this.db.prepare(`
                    INSERT OR REPLACE INTO results (streak_day, user_id, score, is_winner)
                    VALUES (?, ?, ?, ?)
                `);

                for (const result of data.results) {
                    const userId = this.addUser(result.username);
                    insertResult.run(data.day, userId, result.score, result.is_winner ? 1 : 0);
                }
            });

            transaction(parsed);

            // Get count
            const count = this.db.prepare('SELECT COUNT(*) as count FROM results WHERE streak_day = ?').get(streakDay);

            return {
                day: streakDay,
                results_added: count.count,
                users_in_day: parsed.results.map(r => r.username)
            };
        } catch (error) {
            throw error;
        }
    }

    getBriefOverview() {
        const totalStreaks = this.db.prepare('SELECT COUNT(*) as count FROM streaks').get().count;
        const totalUsers = this.db.prepare('SELECT COUNT(*) as count FROM users').get().count;
        const totalEntries = this.db.prepare('SELECT COUNT(*) as count FROM results').get().count;
        const users = this.db.prepare('SELECT username FROM users ORDER BY username').all().map(u => u.username);

        return {
            total_streaks: totalStreaks,
            total_users: totalUsers,
            total_entries: totalEntries,
            users: users
        };
    }

    getDayDetails(day) {
        const streak = this.db.prepare('SELECT day, imported_at FROM streaks WHERE day = ?').get(day);
        
        if (!streak) {
            return null;
        }

        const results = this.db.prepare(`
            SELECT u.username, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.streak_day = ?
            ORDER BY u.username
        `).all(day);

        return {
            day: streak.day,
            imported_at: streak.imported_at,
            participants: results.length,
            results: results.map(r => ({
                username: r.username,
                score: r.score,
                is_winner: r.is_winner === 1
            }))
        };
    }

    deleteDay(day) {
        const transaction = this.db.transaction((dayNum) => {
            this.db.prepare('DELETE FROM results WHERE streak_day = ?').run(dayNum);
            this.db.prepare('DELETE FROM streaks WHERE day = ?').run(dayNum);
        });

        transaction(day);
        return true;
    }

    clearDatabase() {
        const transaction = this.db.transaction(() => {
            this.db.prepare('DELETE FROM results').run();
            this.db.prepare('DELETE FROM streaks').run();
            this.db.prepare('DELETE FROM users').run();
        });

        transaction();
        return true;
    }

    listDays(limit = null) {
        let query = 'SELECT day FROM streaks ORDER BY day';
        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }
        return this.db.prepare(query).all().map(s => s.day);
    }

    getAllUsers() {
        return this.db.prepare('SELECT id, username, first_seen FROM users ORDER BY username').all();
    }

    getAllStreaks() {
        return this.db.prepare('SELECT day, imported_at FROM streaks ORDER BY day').all();
    }

    getAllResults() {
        return this.db.prepare(`
            SELECT r.id, r.streak_day, u.username, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            ORDER BY r.streak_day, u.username
        `).all();
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

module.exports = WordleDatabase;


