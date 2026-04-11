import Database from 'better-sqlite3';
import { config } from './config.js';
import { mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Bot Database Manager
 * Handles all bot-related data: messages, users, birthdays, wordle mappings, etc.
 */
export class BotDatabase {
    constructor(dbPath = null) {
        this.dbPath = dbPath || config.database.bot;

        // Ensure directory exists
        mkdirSync(dirname(this.dbPath), { recursive: true });

        this.db = new Database(this.dbPath);
        this.db.pragma('journal_mode = WAL');
        this.initDatabase();
    }

    initDatabase() {
        // Message log table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS message_log (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        username TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        message_content TEXT NOT NULL,
        display_name TEXT,
        mode TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        message_id TEXT
      )
    `);

        // Temporary users table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS temporary_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        channel_id TEXT NOT NULL,
        webhook_id TEXT NOT NULL,
        webhook_token TEXT NOT NULL,
        webhook_url TEXT NOT NULL,
        display_name TEXT NOT NULL,
        avatar_url TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id, channel_id)
      )
    `);

        // Blocked users table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL UNIQUE,
        username TEXT NOT NULL,
        blocked_by TEXT NOT NULL,
        reason TEXT,
        blocked_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Blocked usernames table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS blocked_usernames (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        pattern TEXT NOT NULL UNIQUE,
        added_by TEXT NOT NULL,
        added_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Birthdays table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthdays (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        birth_month INTEGER NOT NULL,
        birth_day INTEGER NOT NULL,
        timezone TEXT DEFAULT 'UTC',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, guild_id)
      )
    `);

        // Birthday messages table
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthday_messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender_id TEXT NOT NULL,
        recipient_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        message_content TEXT NOT NULL,
        year INTEGER NOT NULL,
        delivered BOOLEAN DEFAULT 0,
        delivered_at DATETIME,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(sender_id, recipient_id, guild_id, year)
      )
    `);

        // Birthday announcements log
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthday_announcements (
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        year INTEGER NOT NULL,
        announced_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(user_id, guild_id, year)
      )
    `);

        // Birthday roles tracking
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthday_roles (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        guild_id TEXT NOT NULL,
        role_id TEXT NOT NULL,
        assigned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        remove_at DATETIME NOT NULL,
        removed BOOLEAN DEFAULT 0,
        UNIQUE(user_id, guild_id, role_id)
      )
    `);

        // Wordle message tracking
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS wordle_message_tracking (
        channel_id TEXT PRIMARY KEY,
        last_message_id TEXT,
        last_message_timestamp DATETIME,
        last_check_timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

        // Wordle username cache (for 3-hour caching)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS wordle_username_cache (
        user_id TEXT PRIMARY KEY,
        display_name TEXT NOT NULL,
        cached_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

        // Birthday settings (key/value per guild)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthday_settings (
        guild_id TEXT NOT NULL,
        key TEXT NOT NULL,
        value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(guild_id, key)
      )
    `);

        // Birthday reminder log (tracks daily DM reminders sent)
        this.db.exec(`
      CREATE TABLE IF NOT EXISTS birthday_reminder_log (
        guild_id TEXT NOT NULL,
        reminder_date TEXT NOT NULL,
        sent_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY(guild_id, reminder_date)
      )
    `);

        // Migrate: add display_name column to birthdays if not present
        try {
            this.db.exec(`ALTER TABLE birthdays ADD COLUMN display_name TEXT`);
        } catch (e) {
            // Column already exists, ignore
        }

        // Create indexes
        this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_birthdays_month_day ON birthdays(birth_month, birth_day);
      CREATE INDEX IF NOT EXISTS idx_birthdays_guild ON birthdays(guild_id);
      CREATE INDEX IF NOT EXISTS idx_birthday_messages_recipient ON birthday_messages(recipient_id, guild_id, year, delivered);
      CREATE INDEX IF NOT EXISTS idx_wordle_cache_expires ON wordle_username_cache(expires_at);
    `);
    }

    // Message logging methods
    logMessage(userId, username, guildId, channelId, messageContent, mode, displayName = null, messageId = null) {
        const stmt = this.db.prepare(`
      INSERT INTO message_log (user_id, username, guild_id, channel_id, message_content, display_name, mode, message_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
        return stmt.run(userId, username, guildId, channelId, messageContent, displayName, mode, messageId).lastInsertRowid;
    }

    // Blocked users methods
    isUserBlocked(userId) {
        const stmt = this.db.prepare('SELECT 1 FROM blocked_users WHERE user_id = ?');
        return stmt.get(userId) !== undefined;
    }

    blockUser(userId, username, blockedBy, reason = null) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO blocked_users (user_id, username, blocked_by, reason)
      VALUES (?, ?, ?, ?)
    `);
        return stmt.run(userId, username, blockedBy, reason).changes > 0;
    }

    unblockUser(userId) {
        const stmt = this.db.prepare('DELETE FROM blocked_users WHERE user_id = ?');
        return stmt.run(userId).changes > 0;
    }

    getBlockedUsers() {
        const stmt = this.db.prepare('SELECT * FROM blocked_users ORDER BY blocked_at DESC');
        return stmt.all();
    }

    // Blocked usernames methods
    addBlockedUsername(pattern, addedBy) {
        const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO blocked_usernames (pattern, added_by)
      VALUES (?, ?)
    `);
        return stmt.run(pattern, addedBy).changes > 0;
    }

    removeBlockedUsername(pattern) {
        const stmt = this.db.prepare('DELETE FROM blocked_usernames WHERE pattern = ?');
        return stmt.run(pattern).changes > 0;
    }

    getBlockedUsernames() {
        const stmt = this.db.prepare('SELECT pattern FROM blocked_usernames ORDER BY added_at DESC');
        return stmt.all().map(row => row.pattern);
    }

    // Wordle message tracking methods
    getLastProcessedMessage(channelId) {
        const stmt = this.db.prepare('SELECT * FROM wordle_message_tracking WHERE channel_id = ?');
        return stmt.get(channelId);
    }

    updateLastProcessedMessage(channelId, messageId, timestamp) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordle_message_tracking (channel_id, last_message_id, last_message_timestamp, last_check_timestamp)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
    `);
        stmt.run(channelId, messageId, timestamp);
    }

    // Wordle username cache methods (3-hour cache)
    getCachedUsernames(userIds) {
        if (userIds.length === 0) return {};

        const placeholders = userIds.map(() => '?').join(',');
        const stmt = this.db.prepare(`
      SELECT user_id, display_name 
      FROM wordle_username_cache 
      WHERE user_id IN (${placeholders}) AND expires_at > datetime('now')
    `);

        const rows = stmt.all(...userIds);
        const result = {};
        rows.forEach(row => {
            result[row.user_id] = row.display_name;
        });
        return result;
    }

    cacheUsernames(userData) {
        const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO wordle_username_cache (user_id, display_name, cached_at, expires_at)
      VALUES (?, ?, datetime('now'), datetime('now', '+3 hours'))
    `);

        const transaction = this.db.transaction((data) => {
            for (const [userId, displayName] of Object.entries(data)) {
                stmt.run(userId, displayName);
            }
        });

        transaction(userData);
    }

    clearExpiredCache() {
        const stmt = this.db.prepare("DELETE FROM wordle_username_cache WHERE expires_at <= datetime('now')");
        return stmt.run().changes;
    }

    // ─── Birthday Settings ────────────────────────────────────────────────────

    getBirthdaySetting(guildId, key, defaultValue = null) {
        const row = this.db.prepare(
            'SELECT value FROM birthday_settings WHERE guild_id = ? AND key = ?'
        ).get(guildId, key);
        return row ? row.value : defaultValue;
    }

    setBirthdaySetting(guildId, key, value) {
        this.db.prepare(`
            INSERT OR REPLACE INTO birthday_settings (guild_id, key, value, updated_at)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        `).run(guildId, key, value);
    }

    // ─── Birthday CRUD ────────────────────────────────────────────────────────

    /** Insert only if user not already in DB (for seeding) */
    seedBirthday(userId, guildId, month, day, displayName) {
        this.db.prepare(`
            INSERT OR IGNORE INTO birthdays (user_id, guild_id, birth_month, birth_day, display_name)
            VALUES (?, ?, ?, ?, ?)
        `).run(userId, guildId, month, day, displayName);
    }

    /** Insert or update (for /birthday set command) */
    setBirthday(userId, guildId, month, day, displayName) {
        this.db.prepare(`
            INSERT INTO birthdays (user_id, guild_id, birth_month, birth_day, display_name, updated_at)
            VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
            ON CONFLICT(user_id, guild_id) DO UPDATE SET
                birth_month = excluded.birth_month,
                birth_day = excluded.birth_day,
                display_name = excluded.display_name,
                updated_at = CURRENT_TIMESTAMP
        `).run(userId, guildId, month, day, displayName);
    }

    removeBirthday(userId, guildId) {
        return this.db.prepare(
            'DELETE FROM birthdays WHERE user_id = ? AND guild_id = ?'
        ).run(userId, guildId).changes > 0;
    }

    getBirthdayByUser(userId, guildId) {
        return this.db.prepare(
            'SELECT * FROM birthdays WHERE user_id = ? AND guild_id = ?'
        ).get(userId, guildId);
    }

    getAllBirthdays(guildId) {
        return this.db.prepare(
            'SELECT * FROM birthdays WHERE guild_id = ? ORDER BY birth_month, birth_day'
        ).all(guildId);
    }

    getBirthdaysByDate(guildId, month, day) {
        return this.db.prepare(
            'SELECT * FROM birthdays WHERE guild_id = ? AND birth_month = ? AND birth_day = ?'
        ).all(guildId, month, day);
    }

    // ─── Birthday Announcements ───────────────────────────────────────────────

    hasBirthdayAnnounced(userId, guildId, year) {
        return this.db.prepare(
            'SELECT 1 FROM birthday_announcements WHERE user_id = ? AND guild_id = ? AND year = ?'
        ).get(userId, guildId, year) !== undefined;
    }

    saveBirthdayAnnouncement(userId, guildId, year) {
        this.db.prepare(`
            INSERT OR IGNORE INTO birthday_announcements (user_id, guild_id, year)
            VALUES (?, ?, ?)
        `).run(userId, guildId, year);
    }

    // ─── Birthday Roles ───────────────────────────────────────────────────────

    assignBirthdayRole(userId, guildId, roleId) {
        this.db.prepare(`
            INSERT OR REPLACE INTO birthday_roles (user_id, guild_id, role_id, assigned_at, remove_at, removed)
            VALUES (?, ?, ?, CURRENT_TIMESTAMP, datetime('now', '+1 day'), 0)
        `).run(userId, guildId, roleId);
    }

    /** Get active role assignments for users whose birthday is today */
    getPendingRoleRemovals(guildId, month, day) {
        return this.db.prepare(`
            SELECT br.* FROM birthday_roles br
            JOIN birthdays b ON b.user_id = br.user_id AND b.guild_id = br.guild_id
            WHERE br.guild_id = ? AND b.birth_month = ? AND b.birth_day = ? AND br.removed = 0
        `).all(guildId, month, day);
    }

    markRoleRemoved(userId, guildId, roleId) {
        this.db.prepare(`
            UPDATE birthday_roles SET removed = 1
            WHERE user_id = ? AND guild_id = ? AND role_id = ?
        `).run(userId, guildId, roleId);
    }

    // ─── Birthday Reminder Log ────────────────────────────────────────────────

    hasReminderSent(guildId, reminderDate) {
        return this.db.prepare(
            'SELECT 1 FROM birthday_reminder_log WHERE guild_id = ? AND reminder_date = ?'
        ).get(guildId, reminderDate) !== undefined;
    }

    markReminderSent(guildId, reminderDate) {
        this.db.prepare(`
            INSERT OR IGNORE INTO birthday_reminder_log (guild_id, reminder_date)
            VALUES (?, ?)
        `).run(guildId, reminderDate);
    }

    close() {
        if (this.db) {
            this.db.close();
        }
    }
}
