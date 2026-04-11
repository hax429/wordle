import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const BASE_DIR = join(__dirname, '..');

/**
 * Unified configuration for both bot and server
 */
export const config = {
    // Discord Bot Configuration
    discord: {
        token: process.env.DISCORD_BOT_TOKEN || '',
        clientId: process.env.DISCORD_CLIENT_ID || '',
        logChannelId: process.env.LOG_CHANNEL_ID || '',
        adminUserIds: (process.env.ADMIN_USER_IDS || '').split(',').filter(id => id.trim()).map(id => id.trim()),
    },

    // Bot Features
    bot: {
        enabledModules: (process.env.ENABLED_MODULES || 'messaging,impersonate,birthday,wordle,april-fools').split(',').map(m => m.trim()),
        tempUserInactivityMinutes: parseInt(process.env.TEMP_USER_INACTIVITY_MINUTES || '30'),
        tempUserCleanupIntervalMinutes: parseInt(process.env.TEMP_USER_CLEANUP_INTERVAL_MINUTES || '5'),
    },

    // Wordle Configuration
    wordle: {
        channelId: process.env.WORDLE_CHANNEL_ID || '',
        auditLogChannelId: process.env.WORDLE_AUDIT_LOG_CHANNEL_ID || '',
        checkIntervalHours: parseInt(process.env.WORDLE_CHECK_INTERVAL_HOURS || '1'),
    },

    // Birthday Configuration
    birthday: {
        adminIds: (process.env.BIRTHDAY_ADMIN_IDS || '').split(',').filter(Boolean).map(s => s.trim()),
        defaultChannelId: process.env.BIRTHDAY_DEFAULT_CHANNEL_ID || '',
        defaultRoleId: process.env.BIRTHDAY_DEFAULT_ROLE_ID || '',
        timezone: process.env.BIRTHDAY_TIMEZONE || 'America/New_York',
        testUserId: process.env.BIRTHDAY_TEST_USER_ID || '',
    },

    // Yearly Review Configuration
    yearlyReview: {
        enabled: process.env.YEARLY_REVIEW_ENABLED === 'true',
        year: parseInt(process.env.YEARLY_REVIEW_YEAR || String(new Date().getFullYear())),
    },

    // April Fools Configuration
    aprilFools: {
        adminIds: (process.env.APRIL_FOOLS_ADMIN_IDS || '').split(',').filter(Boolean).map(s => s.trim()),
        excludedChannelIds: (process.env.APRIL_FOOLS_EXCLUDED_CHANNEL_IDS || '').split(',').filter(Boolean).map(s => s.trim()),
        languages: (process.env.APRIL_FOOLS_LANGUAGES || 'es,fr').split(',').filter(Boolean).map(s => s.trim()),
    },

    // Web Server Configuration
    server: {
        port: parseInt(process.env.PORT || '3000'),
        adminPassword: process.env.ADMIN_PASSWORD || '',
        jwtSecret: process.env.JWT_SECRET || '',
    },

    // Database Paths
    database: {
        bot: process.env.BOT_DATABASE_PATH || join(BASE_DIR, 'data', 'btsd.db'),
        wordle: process.env.WORDLE_DATABASE_PATH || join(BASE_DIR, 'data', 'wordle.db'),
    },

    // Paths
    paths: {
        base: BASE_DIR,
        data: join(BASE_DIR, 'data'),
        logs: join(BASE_DIR, 'data', 'logs'),
        public: join(BASE_DIR, 'public'),
    },

    /**
     * Validate configuration
     */
    validate() {
        const errors = [];

        if (!this.discord.token || this.discord.token === 'your_bot_token_here') {
            errors.push('DISCORD_BOT_TOKEN is not set');
        }

        if (!this.discord.logChannelId) {
            errors.push('LOG_CHANNEL_ID is not set');
        }

        if (this.discord.adminUserIds.length === 0) {
            errors.push('ADMIN_USER_IDS is not set');
        }

        // Web server config is optional (only needed when running web server)
        // if (!this.server.adminPassword) {
        //     errors.push('ADMIN_PASSWORD is not set for web admin console');
        // }
        //
        // if (!this.server.jwtSecret) {
        //     errors.push('JWT_SECRET is not set for web authentication');
        // }

        if (errors.length > 0) {
            throw new Error(`Configuration validation failed:\n  - ${errors.join('\n  - ')}`);
        }
    },

    /**
     * Check if user is admin
     */
    isAdmin(userId) {
        return this.discord.adminUserIds.includes(userId.toString());
    },

    /**
     * Display safe config (hides sensitive data)
     */
    display() {
        return `
Configuration:
  Enabled Modules: ${this.bot.enabledModules.join(', ')}
  Log Channel ID: ${this.discord.logChannelId}
  Admin User IDs: ${this.discord.adminUserIds.join(', ')}
  Wordle Channel: ${this.wordle.channelId}
  Audit Log Channel: ${this.wordle.auditLogChannelId}
  Server Port: ${this.server.port}
  Bot Database: ${this.database.bot}
  Wordle Database: ${this.database.wordle}
  Token: ${'***' + (this.discord.token.slice(-4) || 'NOT SET')}
    `.trim();
    }
};
