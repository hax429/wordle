import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { config } from './config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Wordle Database Manager
 *
 * Handles all Wordle game data:
 *  - users: identified by Discord user_id (not username)
 *  - streaks: one row per Wordle day (day number + calendar date)
 *  - results: per-user score for each streak day
 *  - display_names: Discord display name cache (user_id → name)
 *  - year_comments: AI-generated yearly review blurbs per user
 *
 * Used by both the bot module (bot/modules/wordle.js) and the web server
 * (server/index.js). Each creates its own instance; SQLite WAL mode handles
 * concurrent access safely.
 */
class WordleDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || config.database.wordle;
        this.db = null;
        this.initDatabase();
    }

    initDatabase() {
        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');

        // Create users table - NOW STORES DISCORD USER_ID
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT UNIQUE NOT NULL,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Create streaks table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS streaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day INTEGER UNIQUE NOT NULL,
                date TEXT,
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


        // Create comments table
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS year_comments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT NOT NULL,
                year INTEGER NOT NULL,
                total_games INTEGER NOT NULL,
                comment TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE(username, year)
            )
        `);

        // Display names: maps Discord user_id -> display name
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS display_names (
                user_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        // Settings are now managed in .env
        this.migrateDates();
    }

    // ... existing code ...

    getYearComment(username, year, totalGames) {
        const row = this.db.prepare('SELECT comment FROM year_comments WHERE username = ? AND year = ? AND total_games = ?').get(username, year, totalGames);
        return row ? row.comment : null;
    }

    saveYearComment(username, year, totalGames, comment) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO year_comments (username, year, total_games, comment, created_at)
            VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        `);
        stmt.run(username, year, totalGames, comment);
    }

    // Display name methods
    setDisplayNames(namesMap) {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO display_names (user_id, display_name, updated_at)
            VALUES (?, ?, CURRENT_TIMESTAMP)
        `);
        const transaction = this.db.transaction((data) => {
            for (const [userId, displayName] of Object.entries(data)) {
                stmt.run(userId, displayName);
            }
        });
        transaction(namesMap);
    }

    getAllDisplayNames() {
        const rows = this.db.prepare('SELECT user_id, display_name FROM display_names').all();
        const map = {};
        rows.forEach(r => { map[r.user_id] = r.display_name; });
        return map;
    }

    getDateFromDay(day) {
        // Anchor: Day 218 represents December 23, 2025
        const anchorDay = 218;
        // Month is 0-indexed in JS Date constructor (11 = December)
        const anchorDate = new Date(2025, 11, 23);

        const diffDays = day - anchorDay;
        const targetDate = new Date(anchorDate);
        targetDate.setDate(anchorDate.getDate() + diffDays);

        return targetDate.toISOString().split('T')[0];
    }

    migrateDates() {
        // Check if 'date' column exists
        const tableInfo = this.db.prepare("PRAGMA table_info(streaks)").all();
        const hasDateColumn = tableInfo.some(col => col.name === 'date');

        if (!hasDateColumn) {
            console.log('Adding date column to streaks table...');
            this.db.prepare('ALTER TABLE streaks ADD COLUMN date TEXT').run();
        }

        // Check if dates need migration (i.e. are null)
        const streaks = this.db.prepare('SELECT day FROM streaks WHERE date IS NULL').all();
        if (streaks.length > 0) {
            console.log(`Backfilling dates for ${streaks.length} streaks...`);
            const update = this.db.prepare('UPDATE streaks SET date = ? WHERE day = ?');
            const transaction = this.db.transaction((data) => {
                for (const row of data) {
                    const date = this.getDateFromDay(row.day);
                    update.run(date, row.day);
                }
            });
            transaction(streaks);
            console.log('Date backfill complete.');
        }
    }

    updateEnvFile(key, value) {
        const envPath = path.join(__dirname, '../.env');
        try {
            let content = fs.readFileSync(envPath, 'utf8');
            const regex = new RegExp(`^${key}=.*`, 'm');
            if (regex.test(content)) {
                content = content.replace(regex, `${key}=${value}`);
            } else {
                content += `\n${key}=${value}`;
            }
            fs.writeFileSync(envPath, content);
        } catch (err) {
            console.error('Failed to update .env file:', err);
        }
    }

    getSetting(key) {
        return process.env[key];
    }

    setSetting(key, value) {
        process.env[key] = String(value);
        this.updateEnvFile(key, value);
    }

    getAllSettings() {
        return {
            'visibility_plot': process.env.visibility_plot || 'true',
            'visibility_video': process.env.visibility_video || 'true',
            'visibility_stats': process.env.visibility_stats || 'true',
            'visibility_hall_of_fame': process.env.visibility_hall_of_fame || 'true',
            'visibility_2025': process.env.visibility_2025 || 'true'
        };
    }

    addUser(userId) {
        const insert = this.db.prepare('INSERT OR IGNORE INTO users (user_id) VALUES (?)');
        insert.run(userId);

        const select = this.db.prepare('SELECT id FROM users WHERE user_id = ?');
        const user = select.get(userId);
        return user.id;
    }

    addStreakData(message) {
        try {
            const parsed = parseMessage(message);
            const streakDay = parsed.day;
            const streakDate = this.getDateFromDay(streakDay);

            // Start transaction
            const transaction = this.db.transaction((data) => {
                // Add streak day
                const insertStreak = this.db.prepare('INSERT OR IGNORE INTO streaks (day, date) VALUES (?, ?)');
                insertStreak.run(data.day, streakDate);

                // If it existed but date was null (race condition), update it
                this.db.prepare('UPDATE streaks SET date = ? WHERE day = ? AND date IS NULL').run(streakDate, data.day);

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
                date: streakDate,
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
        const totalGuesses = this.db.prepare("SELECT SUM(CASE WHEN score IN ('1','2','3','4','5','6') THEN CAST(score AS INTEGER) ELSE 0 END) as total FROM results").get().total || 0;
        const users = this.db.prepare('SELECT user_id FROM users ORDER BY user_id').all().map(u => u.user_id);

        const entries = this.db.prepare('SELECT day, date FROM streaks ORDER BY day DESC LIMIT 1').get();

        return {
            total_streaks: totalStreaks,
            total_users: totalUsers,
            total_entries: totalEntries,
            total_guesses: totalGuesses,
            users: users,
            latest_day: entries ? entries.day : null,
            latest_date: entries ? entries.date : null
        };
    }

    getDayDetails(day) {
        const streak = this.db.prepare('SELECT day, date, imported_at FROM streaks WHERE day = ?').get(day);

        if (!streak) {
            return null;
        }

        const results = this.db.prepare(`
            SELECT u.user_id, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.streak_day = ?
            ORDER BY u.user_id
        `).all(day);

        return {
            day: streak.day,
            date: streak.date,
            imported_at: streak.imported_at,
            participants: results.length,
            results: results.map(r => ({
                user_id: r.user_id,
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
        let query = 'SELECT day, date FROM streaks ORDER BY day';
        if (limit) {
            query += ` LIMIT ${parseInt(limit)}`;
        }
        return this.db.prepare(query).all().map(s => ({ day: s.day, date: s.date }));
    }

    getAllUsers() {
        return this.db.prepare('SELECT id, user_id, first_seen FROM users ORDER BY user_id').all();
    }

    getAllStreaks() {
        return this.db.prepare('SELECT day, date, imported_at FROM streaks ORDER BY day').all();
    }

    getAllResults() {
        return this.db.prepare(`
            SELECT r.id, r.streak_day, s.date, u.user_id, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            JOIN streaks s ON r.streak_day = s.day
            ORDER BY r.streak_day, u.user_id
        `).all();
    }

    async getYearlyStats(year, userId) {
        // Filter by user if provided, otherwise just return users who played in that year
        if (!userId) {
            const result = this.db.prepare(`
                SELECT DISTINCT u.user_id
                FROM results r
                JOIN streaks s ON r.streak_day = s.day
                JOIN users u ON r.user_id = u.id
                WHERE strftime('%Y', s.date) = ?
                ORDER BY u.user_id
            `).all(String(year));
            return result.map(r => r.user_id);
        }

        const internalId = this.db.prepare('SELECT id FROM users WHERE user_id = ?').get(userId)?.id;
        if (!internalId) return null;

        const results = this.db.prepare(`
            SELECT r.score, r.is_winner, s.date, s.day
            FROM results r
            JOIN streaks s ON r.streak_day = s.day
            WHERE r.user_id = ? AND strftime('%Y', s.date) = ?
            ORDER BY s.day ASC
        `).all(internalId, String(year));

        if (results.length === 0) return null;

        const totalGames = results.length;

        // "Passing" means not failing (X)
        const totalPassed = results.filter(r => r.score !== 'X').length;
        const passingRate = totalGames > 0 ? (totalPassed / totalGames) * 100 : 0;

        // "Winning" means having the best score of the day (Crown)
        const totalWins = results.filter(r => r.is_winner).length;
        const winningRate = totalGames > 0 ? (totalWins / totalGames) * 100 : 0;

        // Guess distribution
        const guessDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, X: 0 };
        results.forEach(r => {
            if (r.score !== 'X') {
                guessDistribution[r.score] = (guessDistribution[r.score] || 0) + 1;
            } else {
                guessDistribution['X'] = (guessDistribution['X'] || 0) + 1;
            }
        });

        // Best month (lowest average guesses for wins) & Most consistent month (most games)
        const monthStats = {};
        results.forEach(r => {
            const month = r.date.substring(5, 7); // "YYYY-MM-DD" -> "MM"
            if (!monthStats[month]) {
                monthStats[month] = { games: 0, wins: 0, totalGuesses: 0 };
            }
            monthStats[month].games++;
            if (r.score !== 'X') {
                monthStats[month].wins++;
                monthStats[month].totalGuesses += parseInt(r.score);
            }
        });

        let bestMonth = null;
        let lowestAvg = Infinity;
        let consistentMonth = null;
        let maxGames = 0;

        for (const [month, stats] of Object.entries(monthStats)) {
            const avg = stats.wins > 0 ? stats.totalGuesses / stats.wins : Infinity;
            if (stats.wins > 0 && avg < lowestAvg) {
                lowestAvg = avg;
                bestMonth = month;
            }
            if (stats.games > maxGames) {
                maxGames = stats.games;
                consistentMonth = month;
            }
        }

        // Longest streak in the year
        let currentStreak = 0;
        let maxStreak = 0;
        let lastDay = -1;

        results.forEach(r => {
            if (r.score !== 'X') {
                if (lastDay === -1 || r.day === lastDay + 1) {
                    currentStreak++;
                } else {
                    currentStreak = 1;
                }
                lastDay = r.day;
                if (currentStreak > maxStreak) maxStreak = currentStreak;
            } else {
                currentStreak = 0;
                lastDay = -1;
            }
        });

        return {
            userId,
            year,
            totalGames,
            passingRate,
            winningRate,
            guessDistribution,
            bestMonth: bestMonth ? { month: bestMonth, avgGuesses: lowestAvg.toFixed(2) } : null,
            consistentMonth: consistentMonth ? { month: consistentMonth, games: maxGames } : null,
            rawGames: results.map(r => ({
                date: r.date,
                score: r.score,
                is_winner: r.is_winner === 1
            })),
            maxStreak
        };
    }

    addResult(day, userId, score, isWinner) {
        const internalId = this.addUser(userId);

        // Ensure streak day exists
        const date = this.getDateFromDay(day);
        this.db.prepare('INSERT OR IGNORE INTO streaks (day, date) VALUES (?, ?)').run(day, date);

        const insert = this.db.prepare(`
            INSERT INTO results (streak_day, user_id, score, is_winner)
            VALUES (?, ?, ?, ?)
        `);

        try {
            insert.run(day, internalId, score, isWinner ? 1 : 0);
            return { success: true };
        } catch (error) {
            if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
                throw new Error('Result already exists for this user on this day');
            }
            throw error;
        }
    }

    updateResult(day, userId, score, isWinner) {
        const internalId = this.addUser(userId);

        // Ensure streak day exists
        const date = this.getDateFromDay(day);
        this.db.prepare('INSERT OR IGNORE INTO streaks (day, date) VALUES (?, ?)').run(day, date);

        const update = this.db.prepare(`
            INSERT OR REPLACE INTO results (streak_day, user_id, score, is_winner)
            VALUES (?, ?, ?, ?)
        `);

        update.run(day, internalId, score, isWinner ? 1 : 0);
        return { success: true };
    }

    deleteResult(day, userId) {
        const internalId = this.addUser(userId);
        const result = this.db.prepare('DELETE FROM results WHERE streak_day = ? AND user_id = ?').run(day, internalId);
        return result.changes > 0;
    }

    deleteUser(id) {
        const transaction = this.db.transaction((userId) => {
            this.db.prepare('DELETE FROM results WHERE user_id = ?').run(userId);
            this.db.prepare('DELETE FROM users WHERE id = ?').run(userId);
        });

        transaction(id);
        return true;
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}

export default WordleDatabase;


