#!/usr/bin/env node

/**
 * BTSD Unified Service
 * Runs both Discord bot and web server
 */

import BTSDBot from './bot/index.js';
import { startServer } from './server/index.js';
import { config } from './shared/config.js';

console.log('='.repeat(60));
console.log('🚀 BTSD Unified Service Starting...');
console.log('='.repeat(60));

// Validate configuration
try {
    config.validate();
    console.log('✅ Configuration validated');
} catch (error) {
    console.error('❌ Configuration validation failed:');
    console.error(error.message);
    process.exit(1);
}

// Start both services
(async () => {
    try {
        console.log('\n📱 Starting Discord Bot...');
        const bot = new BTSDBot();
        global.bot = bot; // Keep this for graceful shutdown
        await bot.start();
        console.log('✅ Discord Bot started successfully');

        console.log('\n🌍 Starting Web Server...');
        await startServer();
        console.log('✅ Web Server started successfully');

        console.log('\n' + '='.repeat(60));
        console.log('✅ BTSD Unified Service is running');
        console.log('='.repeat(60));
    } catch (error) {
        console.error('\n❌ Fatal Error during startup:');
        console.error(error);
        process.exit(1);
    }
})();

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n\n📡 Received SIGINT signal - shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n\n📡 Received SIGTERM signal - shutting down gracefully...');
    if (global.bot) {
        await global.bot.shutdown();
    }
    process.exit(0);
});
