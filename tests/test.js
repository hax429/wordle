#!/usr/bin/env node

/**
 * Structural smoke test — verifies bot/server setup without connecting to Discord.
 *
 * Run from the project root:
 *   node tests/test.js
 *
 * Requires a valid .env file (or the config defaults) and the data/ directory.
 */

import { config } from '../shared/config.js';
import { BotDatabase } from '../shared/bot-database.js';
import WordleDatabase from '../shared/wordle-database.js';

console.log('🧪 Testing unified service structure...\n');

// Test 1: Configuration
console.log('1️⃣ Testing configuration...');
try {
    console.log('   Bot modules:', config.bot.enabledModules);
    console.log('   Wordle channel:', config.wordle.channelId);
    console.log('   Server port:', config.server.port);
    console.log('   ✅ Configuration loaded\n');
} catch (error) {
    console.error('   ❌ Configuration error:', error.message);
    process.exit(1);
}

// Test 2: Bot Database
console.log('2️⃣ Testing bot database...');
try {
    const botDb = new BotDatabase();
    console.log('   Database path:', botDb.dbPath);

    // Verify basic query works
    const blocked = botDb.isUserBlocked('test_user_123');
    console.log('   Test query executed:', !blocked ? 'user not blocked' : 'user blocked');

    botDb.close();
    console.log('   ✅ Bot database working\n');
} catch (error) {
    console.error('   ❌ Bot database error:', error.message);
    process.exit(1);
}

// Test 3: Wordle Database
console.log('3️⃣ Testing Wordle database...');
try {
    const wordleDb = new WordleDatabase();
    console.log('   Database path:', wordleDb.dbPath);

    const overview = wordleDb.getBriefOverview();
    console.log('   Total streaks:', overview.total_streaks);
    console.log('   Total users:', overview.total_users);
    console.log('   Total entries:', overview.total_entries);

    wordleDb.close();
    console.log('   ✅ Wordle database working\n');
} catch (error) {
    console.error('   ❌ Wordle database error:', error.message);
    console.error('   Stack:', error.stack);
    process.exit(1);
}

console.log('✅ All tests passed!');
console.log('\n📝 Next steps:');
console.log('   1. Update .env with your Discord bot token');
console.log('   2. Run: node index.js');
console.log('   3. Test /wordle-test command in Discord');
console.log('   4. Test /wordle-process command in Discord');
