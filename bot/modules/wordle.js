import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../../shared/config.js';
import WordleDatabase from '../../shared/wordle-database.js';

/**
 * Wordle Integration Module
 * Monitors #nothing-but-wordle channel hourly and processes Wordle streak messages
 */

let bot = null;
let wordleDb = null;
let checkInterval = null;

/**
 * Build a reverse lookup map: lowercase display name -> user_id
 * Used to resolve text-based @DisplayName mentions to Discord user IDs.
 */
function buildReverseNameMap() {
    const namesMap = wordleDb.getAllDisplayNames(); // {userId: displayName}
    const reverse = {};
    for (const [userId, displayName] of Object.entries(namesMap)) {
        reverse[displayName.toLowerCase().trim()] = userId;
    }
    return reverse;
}

/**
 * Parse Wordle message and extract user IDs and scores.
 * Supports both Discord ID mentions (<@userId>) and plain text @DisplayName mentions.
 * @param {Message} message - Discord message object
 * @param {Object} reverseNameMap - Map of lowercase display name -> user_id for text mention fallback
 */
function parseWordleMessage(message, reverseNameMap = {}) {
    const content = message.content;

    // Check if this is a Wordle streak message
    if (!content.includes('day streak')) {
        return null;
    }

    // Extract streak day
    const streakMatch = content.match(/(\d+) day streak/);
    if (!streakMatch) {
        return null;
    }

    const streakDay = parseInt(streakMatch[1]);
    const results = [];

    // Find all score lines with pattern: score + mentions
    const scorePattern = /(👑\s*)?([1-6X])\/6:\s*([^👑]*?)(?=(?:[1-6X]\/6:|$))/g;
    let match;

    while ((match = scorePattern.exec(content)) !== null) {
        const score = match[2];
        const userSection = match[3];

        // Try Discord ID mentions first: <@userId> or <@!userId>
        const mentionPattern = /<@!?(\d+)>/g;
        let mentionMatch;
        let foundIdMentions = false;

        while ((mentionMatch = mentionPattern.exec(userSection)) !== null) {
            foundIdMentions = true;
            results.push({ user_id: mentionMatch[1], score, is_winner: false });
        }

        // Fall back to plain text @DisplayName mentions if no ID mentions found
        if (!foundIdMentions) {
            // Split on @ boundaries: each @ starts a new name up to the next @ or end
            const textMentionPattern = /@([^@]+?)(?=\s*@|\s*$)/g;
            let textMatch;
            while ((textMatch = textMentionPattern.exec(userSection.trim())) !== null) {
                // Unescape Discord markdown escapes (e.g. \! -> !) before lookup
                const displayName = textMatch[1].trim().replace(/\\(.)/g, '$1');
                const userId = reverseNameMap[displayName.toLowerCase()];
                if (userId) {
                    results.push({ user_id: userId, score, is_winner: false });
                } else {
                    console.log(`[Wordle] ⚠️ Could not resolve text mention "@${displayName}" to a user ID`);
                }
            }
        }
    }

    // Calculate winners (lowest score)
    const validScores = results.filter(r => r.score !== 'X').map(r => parseInt(r.score));
    if (validScores.length > 0) {
        const minScore = Math.min(...validScores);
        results.forEach(result => {
            if (result.score !== 'X') {
                result.is_winner = parseInt(result.score) === minScore;
            }
        });
    }

    return { day: streakDay, results };
}

/**
 * Process Wordle message and save to database
 */
async function processWordleMessage(message, reverseNameMap = {}) {
    const logger = console;

    try {
        logger.log(`[Wordle] Processing message from ${message.author.tag}`);

        // Parse message
        const parsed = parseWordleMessage(message, reverseNameMap);

        if (!parsed || parsed.results.length === 0) {
            logger.log('[Wordle] No valid results found in message');
            return null;
        }

        logger.log(`[Wordle] Found ${parsed.results.length} results for day ${parsed.day}`);

        // Calculate date from day
        const date = wordleDb.getDateFromDay(parsed.day);

        // Save to database
        const transaction = wordleDb.db.transaction((data) => {
            // Add streak day
            wordleDb.db.prepare('INSERT OR IGNORE INTO streaks (day, date) VALUES (?, ?)').run(data.day, date);

            // Add results
            const insertResult = wordleDb.db.prepare(`
        INSERT OR REPLACE INTO results (streak_day, user_id, score, is_winner)
        VALUES (?, ?, ?, ?)
      `);

            for (const result of data.results) {
                // Ensure user exists
                wordleDb.db.prepare('INSERT OR IGNORE INTO users (user_id) VALUES (?)').run(result.user_id);

                // Get user's internal ID
                const user = wordleDb.db.prepare('SELECT id FROM users WHERE user_id = ?').get(result.user_id);

                insertResult.run(data.day, user.id, result.score, result.is_winner ? 1 : 0);
            }
        });

        transaction(parsed);

        logger.log(`[Wordle] ✅ Successfully processed day ${parsed.day}`);

        return { day: parsed.day, date, results_count: parsed.results.length };

    } catch (error) {
        logger.error('[Wordle] Error processing message:', error);
        return null;
    }
}

/**
 * Fetch Discord display names for a list of user IDs and save to wordle DB.
 */
async function fetchAndSaveDisplayNames(guild, userIds) {
    if (!guild || userIds.length === 0) return;
    try {
        const members = await guild.members.fetch({ user: userIds });
        const namesMap = {};
        members.forEach(member => { namesMap[member.id] = member.displayName; });
        if (Object.keys(namesMap).length > 0) {
            wordleDb.setDisplayNames(namesMap);
            console.log(`[Wordle] Updated display names for ${Object.keys(namesMap).length} users`);
        }
    } catch (error) {
        console.error('[Wordle] Error syncing display names:', error.message);
    }
}

/**
 * Sync display names for users mentioned in a batch of messages.
 */
async function syncDisplayNames(guild, messages) {
    const userIds = new Set();
    const mentionPattern = /<@!?(\d+)>/g;
    for (const message of messages) {
        let m;
        while ((m = mentionPattern.exec(message.content)) !== null) {
            userIds.add(m[1]);
        }
    }
    await fetchAndSaveDisplayNames(guild, Array.from(userIds));
}

/**
 * Sync display names for ALL users stored in the wordle DB (run once on startup).
 */
async function syncAllDisplayNames() {
    try {
        const channel = await bot.client.channels.fetch(config.wordle.channelId);
        if (!channel?.guild) return;
        const allUserIds = wordleDb.db.prepare('SELECT user_id FROM users').all().map(r => r.user_id);
        console.log(`[Wordle] Syncing display names for ${allUserIds.length} existing users...`);
        await fetchAndSaveDisplayNames(channel.guild, allUserIds);
    } catch (error) {
        console.error('[Wordle] Error in startup display name sync:', error.message);
    }
}

/**
 * Check for new Wordle messages
 */
async function checkForNewMessages() {
    const logger = console;

    try {
        const channelId = config.wordle.channelId;
        const channel = await bot.client.channels.fetch(channelId);

        if (!channel) {
            logger.error(`[Wordle] Cannot access channel ${channelId}`);
            return;
        }

        logger.log(`[Wordle] Checking for new messages in #${channel.name}`);

        // Build a complete reverse map from ALL guild members once per check.
        // This is fetched directly from Discord so even users not yet in the DB
        // can be resolved from plain-text @DisplayName mentions.
        let reverseNameMap = {};
        try {
            const allMembers = await channel.guild.members.fetch();
            allMembers.forEach(member => {
                reverseNameMap[member.displayName.toLowerCase().trim()] = member.id;
            });
            // Persist any new display names we just learned
            const namesMap = {};
            allMembers.forEach(m => { namesMap[m.id] = m.displayName; });
            wordleDb.setDisplayNames(namesMap);
            logger.log(`[Wordle] Built reverse name map from ${allMembers.size} guild members`);
        } catch (e) {
            logger.error('[Wordle] Could not fetch guild members, falling back to DB cache:', e.message);
            reverseNameMap = buildReverseNameMap();
        }

        let totalProcessed = 0;
        let batchCount = 0;

        // Loop in batches to catch up if many messages are behind
        while (true) {
            // Re-read the pointer each iteration so it reflects the last batch's advance
            const lastProcessed = bot.db.getLastProcessedMessage(channelId);

            const options = { limit: 50 };
            if (lastProcessed && lastProcessed.last_message_id) {
                options.after = lastProcessed.last_message_id;
            }

            const messages = await channel.messages.fetch(options);

            if (messages.size === 0) {
                if (batchCount === 0) logger.log('[Wordle] No new messages found');
                break;
            }

            batchCount++;
            logger.log(`[Wordle] Batch ${batchCount}: found ${messages.size} messages`);

            // Process in chronological order
            const sortedMessages = Array.from(messages.values()).sort((a, b) => a.createdTimestamp - b.createdTimestamp);

            let batchProcessed = 0;
            for (const message of sortedMessages) {
                const result = await processWordleMessage(message, reverseNameMap);
                if (result) {
                    batchProcessed++;
                    totalProcessed++;
                    await sendAuditLog(result);
                }
            }

            // Collect all user IDs mentioned in this batch and update display names
            await syncDisplayNames(channel.guild, sortedMessages);

            // Always advance the pointer to the last fetched message — even if no
            // Wordle messages were found — so non-Wordle messages don't block progress.
            const lastMessage = sortedMessages[sortedMessages.length - 1];
            bot.db.updateLastProcessedMessage(channelId, lastMessage.id, lastMessage.createdAt.toISOString());

            logger.log(`[Wordle] Batch ${batchCount}: processed ${batchProcessed} Wordle messages`);

            // Caught up when the batch is smaller than the limit
            if (messages.size < 50) break;
        }

        if (totalProcessed > 0) {
            logger.log(`[Wordle] ✅ Processed ${totalProcessed} Wordle messages total`);
        }

    } catch (error) {
        logger.error('[Wordle] Error checking for messages:', error);
    }
}

/**
 * Send confirmation to audit log channel
 */
async function sendAuditLog(result) {
    try {
        const auditChannelId = config.wordle.auditLogChannelId;
        const channel = await bot.client.channels.fetch(auditChannelId);

        if (!channel) {
            console.error(`[Wordle] Cannot access audit log channel ${auditChannelId}`);
            return;
        }

        const embed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setTitle('✅ Wordle Data Processed')
            .addFields(
                { name: 'Day', value: result.day.toString(), inline: true },
                { name: 'Date', value: result.date, inline: true },
                { name: 'Results', value: result.results_count.toString(), inline: true }
            )
            .setTimestamp();

        await channel.send({ embeds: [embed] });
    } catch (error) {
        console.error('[Wordle] Error sending audit log:', error);
    }
}

/**
 * Manual trigger command
 */
const processCommand = {
    data: new SlashCommandBuilder()
        .setName('wordle-process')
        .setDescription('Manually process new Wordle messages (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, botInstance) {
        // Check if user is admin
        if (!config.isAdmin(interaction.user.id)) {
            await interaction.reply({
                content: '❌ This command is restricted to administrators.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            await checkForNewMessages();
            await interaction.followUp({
                content: '✅ Wordle message check complete! Check #audit-log for results.',
                ephemeral: true
            });
        } catch (error) {
            console.error('[Wordle] Error in manual process:', error);
            await interaction.followUp({
                content: '❌ An error occurred while processing messages.',
                ephemeral: true
            });
        }
    }
};

/**
 * Test command to check channel access
 */
const testCommand = {
    data: new SlashCommandBuilder()
        .setName('wordle-test')
        .setDescription('Test connection to Wordle channel (Admin only)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),

    async execute(interaction, botInstance) {
        if (!config.isAdmin(interaction.user.id)) {
            await interaction.reply({
                content: '❌ This command is restricted to administrators.',
                ephemeral: true
            });
            return;
        }

        await interaction.deferReply({ ephemeral: true });

        try {
            const channelId = config.wordle.channelId;
            const channel = await botInstance.client.channels.fetch(channelId);

            if (!channel) {
                await interaction.followUp({
                    content: `❌ Cannot access channel ${channelId}`,
                    ephemeral: true
                });
                return;
            }

            // Try to fetch recent messages
            const messages = await channel.messages.fetch({ limit: 5 });

            let response = `✅ Bot can access #${channel.name}\n\n**Recent messages:**\n`;
            messages.forEach(msg => {
                const preview = msg.content.substring(0, 100);
                response += `\n• ${msg.author.tag}: ${preview}${msg.content.length > 100 ? '...' : ''}`;
            });

            await interaction.followUp({
                content: response,
                ephemeral: true
            });

        } catch (error) {
            await interaction.followUp({
                content: `❌ Error: ${error.message}`,
                ephemeral: true
            });
        }
    }
};

/**
 * Module initialization
 */
export default {
    name: 'wordle',

    async init(botInstance) {
        bot = botInstance;
        console.log('[Wordle] Initializing module...');

        // Initialize Wordle database
        wordleDb = new WordleDatabase();
        console.log('[Wordle] Database initialized');

        // Register commands
        bot.client.commands.set('wordle-process', processCommand);
        bot.client.commands.set('wordle-test', testCommand);

        // Start hourly check interval
        const intervalMs = config.wordle.checkIntervalHours * 60 * 60 * 1000;
        checkInterval = setInterval(checkForNewMessages, intervalMs);

        console.log(`[Wordle] ✅ Hourly check scheduled (every ${config.wordle.checkIntervalHours} hour(s))`);

        // Run initial check after 1 minute
        setTimeout(checkForNewMessages, 60000);
        console.log('[Wordle] Initial check scheduled for 1 minute from now');

        // Sync display names for all existing users 30 seconds after startup
        setTimeout(syncAllDisplayNames, 30000);
        console.log('[Wordle] Display name sync scheduled for 30 seconds from now');
    },

    async cleanup() {
        console.log('[Wordle] Cleaning up module...');

        if (checkInterval) {
            clearInterval(checkInterval);
            console.log('[Wordle] Stopped hourly check');
        }

        if (wordleDb) {
            wordleDb.close();
            console.log('[Wordle] Closed database');
        }
    }
};
