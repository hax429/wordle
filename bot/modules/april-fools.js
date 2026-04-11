import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import { getOrCreateWebhook, sendWebhookMessage } from '../../shared/webhooks.js';
import { config } from '../../shared/config.js';
import { existsSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const STATE_FILE = join(__dirname, '../../data/april-fools-state.json');

/**
 * April Fools Module
 * On April 1 (Eastern Time), intercepts all messages, deletes them, translates
 * them via Google Cloud Translation, and resends them anonymously.
 *
 * Authorized admins can manually start/stop the mode via /service start and /service terminate.
 */

const GOOGLE_TRANSLATE_API_KEY = process.env.GOOGLE_TRANSLATE_API_KEY || '';
const GOOGLE_TRANSLATE_URL = 'https://translation.googleapis.com/language/translate/v2';
const SCHEDULE_CHECK_INTERVAL_MS = 5 * 60 * 1000; // check every 5 minutes

let bot = null;
let isActive = false;
let messageHandler = null;
let scheduleInterval = null;

function loadState() {
    try {
        if (existsSync(STATE_FILE)) {
            return JSON.parse(readFileSync(STATE_FILE, 'utf8')).active === true;
        }
    } catch (e) { /* ignore */ }
    return false;
}

function saveState(active) {
    try {
        writeFileSync(STATE_FILE, JSON.stringify({ active }), 'utf8');
    } catch (e) {
        console.warn('[AprilFools] Could not save state:', e.message);
    }
}

// ─── Timezone helper ────────────────────────────────────────────────────────

function isAprilFirstEastern() {
    const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        month: 'numeric',
        day: 'numeric',
    }).formatToParts(new Date());

    const month = parseInt(parts.find(p => p.type === 'month').value);
    const day   = parseInt(parts.find(p => p.type === 'day').value);
    return month === 4 && day === 1;
}

// ─── Translation ─────────────────────────────────────────────────────────────

const LANGUAGES = config.aprilFools.languages;

async function translateText(text) {
    const target = LANGUAGES[Math.floor(Math.random() * LANGUAGES.length)];

    try {
        const response = await fetch(`${GOOGLE_TRANSLATE_URL}?key=${GOOGLE_TRANSLATE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ q: text, target, format: 'text' }),
        });

        if (!response.ok) {
            console.error(`[AprilFools] Google Translate ${response.status}:`, await response.text());
            return text;
        }

        const data = await response.json();
        return data.data?.translations?.[0]?.translatedText || text;
    } catch (error) {
        console.error('[AprilFools] Translation error:', error.message);
        return text;
    }
}

// ─── Message interception ────────────────────────────────────────────────────

async function handleMessage(message) {
    // Ignore bots and DMs
    if (message.author.bot) return;
    if (!message.guild) return;
    if (config.aprilFools.excludedChannelIds.includes(message.channel.id)) return;

    // Only intercept messages with text content
    const content = message.content?.trim();
    if (!content) return;

    const isReply = !!(message.reference?.messageId);
    const channel = message.channel;

    // Fire delete immediately without awaiting — run in parallel with translation + webhook
    const deletePromise = message.delete().catch(err =>
        console.warn('[AprilFools] Delete failed:', err.message)
    );

    // Translate and fetch webhook simultaneously for speed
    const [translated, webhookInfo] = await Promise.all([
        translateText(content),
        getOrCreateWebhook(channel, 'Anonymous'),
    ]);

    if (!webhookInfo) return;

    const options = {};

    if (isReply) {
        try {
            const originalMessage = await channel.messages.fetch(message.reference.messageId);
            const previewText = originalMessage.content
                ? originalMessage.content.substring(0, 500) + (originalMessage.content.length > 500 ? '...' : '')
                : '*(no text)*';

            const embed = new EmbedBuilder()
                .setDescription(previewText)
                .setColor(0xd3d3d3)
                .setAuthor({
                    name: `Replying to ${originalMessage.author.displayName || originalMessage.author.username}`,
                    iconURL: originalMessage.author.displayAvatarURL(),
                })
                .addFields({ name: 'Original Message', value: `[Jump to Message](${originalMessage.url})` });

            options.embeds = [embed];
        } catch (err) {
            console.warn('[AprilFools] Could not fetch original message for reply embed:', err.message);
        }
    }

    // Send anonymous message and ensure delete both complete
    await Promise.all([
        sendWebhookMessage(webhookInfo.url, translated, 'Anonymous', null, options).catch(err =>
            console.error('[AprilFools] Failed to send webhook message:', err.message)
        ),
        deletePromise,
    ]);
}

// ─── Activate / Deactivate ───────────────────────────────────────────────────

function activate() {
    if (isActive) {
        console.log('[AprilFools] Mode is already active.');
        return;
    }
    isActive = true;
    saveState(true);
    console.log('[AprilFools] Activating April Fools mode!');

    messageHandler = (message) => handleMessage(message).catch(err =>
        console.error('[AprilFools] Unhandled error in message handler:', err)
    );
    bot.client.on('messageCreate', messageHandler);
}

function deactivate() {
    if (!isActive) {
        console.log('[AprilFools] Mode is already inactive.');
        return;
    }
    isActive = false;
    saveState(false);
    console.log('[AprilFools] Deactivating April Fools mode.');

    if (messageHandler) {
        bot.client.off('messageCreate', messageHandler);
        messageHandler = null;
    }
}

// ─── /service slash command ───────────────────────────────────────────────────

const serviceCommand = {
    data: new SlashCommandBuilder()
        .setName('service')
        .setDescription('Control April Fools mode (authorized users only)')
        .addSubcommand(sub =>
            sub.setName('start')
                .setDescription('Activate April Fools mode')
        )
        .addSubcommand(sub =>
            sub.setName('terminate')
                .setDescription('Deactivate April Fools mode')
        ),

    async execute(interaction) {
        if (!config.aprilFools.adminIds.includes(interaction.user.id)) {
            await interaction.reply({ content: '❌ You are not authorized to use this command.', ephemeral: true });
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        if (subcommand === 'start') {
            activate();
            await interaction.reply({ content: '🎭 April Fools mode activated!', ephemeral: true });
        } else if (subcommand === 'terminate') {
            deactivate();
            await interaction.reply({ content: '✅ April Fools mode deactivated.', ephemeral: true });
        }
    },
};

// ─── Module lifecycle ────────────────────────────────────────────────────────

export default {
    name: 'april-fools',

    async init(botInstance) {
        bot = botInstance;
        console.log('[AprilFools] Initializing module...');

        // Register /service slash command
        bot.client.commands.set('service', serviceCommand);

        // Auto-activate if April 1 ET, or if manually started before last restart
        if (isAprilFirstEastern() || loadState()) {
            console.log('[AprilFools] Restoring active state...');
            activate();
        }

        // Periodically sync activation state with the current Eastern date
        scheduleInterval = setInterval(() => {
            const shouldBeActive = isAprilFirstEastern();
            if (shouldBeActive && !isActive) {
                console.log('[AprilFools] April 1 detected — auto-activating!');
                activate();
            } else if (!shouldBeActive && isActive) {
                console.log('[AprilFools] April 1 ended — auto-deactivating!');
                deactivate();
            }
        }, SCHEDULE_CHECK_INTERVAL_MS);

        console.log('[AprilFools] ✅ Module initialized');
    },

    async cleanup() {
        if (scheduleInterval) {
            clearInterval(scheduleInterval);
            scheduleInterval = null;
        }
        deactivate();
        console.log('[AprilFools] Module cleaned up');
    },
};
