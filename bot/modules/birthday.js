import { SlashCommandBuilder, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import { config } from '../../shared/config.js';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Birthday Module
 * - Seeds member birthdays into DB
 * - Sends DM reminders the day before (20:00 NY time)
 * - Announces birthday at 00:00 NY time & assigns role
 * - Removes birthday role at 23:59 NY time
 * - /birthday command for admins to manage birthdays & settings
 */

// ─── Constants ────────────────────────────────────────────────────────────────

const BIRTHDAY_ADMINS = config.birthday.adminIds;
const DEFAULT_CHANNEL = config.birthday.defaultChannelId;
const DEFAULT_ROLE = config.birthday.defaultRoleId;
const TIMEZONE = config.birthday.timezone;

const DEFAULT_BIRTHDAY_MSG =
    `🎂✨ **Happy Birthday, {mention}!** ✨🎂\n\n` +
    `Today is **{name}**'s special day! 🥳🎉\n\n` +
    `Wishing you a day overflowing with joy, laughter, and everything that makes you smile. ` +
    `You make this server a better place and we're so lucky to have you here! 🎈\n\n` +
    `May this year be your absolute best one yet! 🌟\n\n` +
    `— with love, from everyone in BTSD 💙`;

const DEFAULT_REMINDER_MSG =
    `🔔 **Heads up!** Tomorrow is **{name}**'s birthday! 🎂\n` +
    `Don't forget to wish them a happy birthday! 🎉`;

const MONTHS = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
];

// Members to seed — loaded from data/birthday-seed.json (gitignored)
let BIRTHDAY_SEED = [];
try {
    BIRTHDAY_SEED = JSON.parse(readFileSync(join(__dirname, '../../data/birthday-seed.json'), 'utf8'));
} catch {
    console.warn('[Birthday] Could not load birthday-seed.json — no birthdays will be seeded');
}

// ─── Module state ─────────────────────────────────────────────────────────────

let bot = null;
let schedulerInterval = null;
let primaryGuildId = null;

// Track last run date for each daily job to prevent duplicate execution
let lastAnnouncementDate = null;
let lastReminderDate = null;
let lastRoleRemovalDate = null;

// ─── Time helpers ─────────────────────────────────────────────────────────────

function getNY() {
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        year: 'numeric', month: 'numeric', day: 'numeric',
        hour: 'numeric', minute: 'numeric',
        hour12: false,
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(new Date()).map(p => [p.type, p.value])
    );
    const year  = parseInt(parts.year);
    const month = parseInt(parts.month);
    const day   = parseInt(parts.day);
    const hour  = parseInt(parts.hour === '24' ? '0' : parts.hour);
    const min   = parseInt(parts.minute);
    const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return { year, month, day, hour, min, dateStr };
}

/** Returns tomorrow's {month, day} in NY time */
function getTomorrowNY() {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: TIMEZONE,
        month: 'numeric', day: 'numeric',
    });
    const parts = Object.fromEntries(
        formatter.formatToParts(tomorrow).map(p => [p.type, p.value])
    );
    return { month: parseInt(parts.month), day: parseInt(parts.day) };
}

// ─── Settings helpers ─────────────────────────────────────────────────────────

function getSetting(key, fallback) {
    if (!primaryGuildId) return fallback;
    return bot.db.getBirthdaySetting(primaryGuildId, key, fallback);
}

// ─── Scheduler ────────────────────────────────────────────────────────────────

async function runScheduler() {
    try {
        const ny = getNY();

        // 00:00 — birthday announcements + role assignment
        if (ny.hour === 0 && ny.min === 0 && lastAnnouncementDate !== ny.dateStr) {
            lastAnnouncementDate = ny.dateStr;
            await announceBirthdays(ny);
        }

        // 20:00 — DM reminders for tomorrow's birthdays
        if (ny.hour === 20 && ny.min === 0 && lastReminderDate !== ny.dateStr) {
            lastReminderDate = ny.dateStr;
            await sendReminders(ny);
        }

        // 23:59 — remove birthday roles
        if (ny.hour === 23 && ny.min === 59 && lastRoleRemovalDate !== ny.dateStr) {
            lastRoleRemovalDate = ny.dateStr;
            await removeExpiredRoles(ny);
        }
    } catch (err) {
        console.error('[Birthday] Scheduler error:', err);
    }
}

// ─── Birthday announcement (00:00) ───────────────────────────────────────────

async function announceBirthdays(ny) {
    const birthdays = bot.db.getBirthdaysByDate(primaryGuildId, ny.month, ny.day);
    if (birthdays.length === 0) return;

    const channelId = getSetting('announcement_channel', DEFAULT_CHANNEL);
    const roleId    = getSetting('birthday_role', DEFAULT_ROLE);
    const template  = getSetting('birthday_message', DEFAULT_BIRTHDAY_MSG);

    let channel;
    try {
        channel = await bot.client.channels.fetch(channelId);
    } catch (err) {
        console.error('[Birthday] Could not fetch announcement channel:', err.message);
        return;
    }

    const guild = channel.guild;

    for (const bday of birthdays) {
        // Skip if already announced this year
        if (bot.db.hasBirthdayAnnounced(bday.user_id, primaryGuildId, ny.year)) continue;

        const mention = `<@${bday.user_id}>`;
        const name    = bday.display_name || mention;
        const message = template
            .replace(/\{mention\}/g, mention)
            .replace(/\{name\}/g, name);

        await channel.send(message);
        bot.db.saveBirthdayAnnouncement(bday.user_id, primaryGuildId, ny.year);

        // Assign birthday role
        try {
            const member = await guild.members.fetch(bday.user_id);
            await member.roles.add(roleId);
            bot.db.assignBirthdayRole(bday.user_id, primaryGuildId, roleId);
            console.log(`[Birthday] Assigned role to ${name}`);
        } catch (err) {
            console.error(`[Birthday] Could not assign role to ${bday.user_id}:`, err.message);
        }
    }
}

// ─── DM reminders (20:00, day before) ────────────────────────────────────────

async function sendReminders(ny) {
    const tomorrow = getTomorrowNY();
    const birthdayPeople = bot.db.getBirthdaysByDate(primaryGuildId, tomorrow.month, tomorrow.day);
    if (birthdayPeople.length === 0) return;

    // Prevent duplicate reminders if bot restarted
    const tomorrowStr = `${ny.year}-${String(tomorrow.month).padStart(2,'0')}-${String(tomorrow.day).padStart(2,'0')}`;
    if (bot.db.hasReminderSent(primaryGuildId, tomorrowStr)) return;

    const template = getSetting('reminder_message', DEFAULT_REMINDER_MSG);

    // Build display list of birthday people
    const birthdayNames = birthdayPeople.map(b => b.display_name || `<@${b.user_id}>`);
    const birthdayUserIds = new Set(birthdayPeople.map(b => b.user_id));

    let guild;
    try {
        guild = await bot.client.guilds.fetch(primaryGuildId);
        await guild.members.fetch(); // populate cache
    } catch (err) {
        console.error('[Birthday] Could not fetch guild members:', err.message);
        return;
    }

    let sentCount = 0;
    for (const [, member] of guild.members.cache) {
        if (member.user.bot) continue;
        if (birthdayUserIds.has(member.id)) continue; // skip birthday person

        // Build the reminder message (one message per birthday person tomorrow)
        for (const bday of birthdayPeople) {
            const name    = bday.display_name || `<@${bday.user_id}>`;
            const message = template.replace(/\{name\}/g, name);
            try {
                await member.send(message);
                sentCount++;
            } catch (err) {
                // User has DMs disabled — silently skip
            }
        }
    }

    bot.db.markReminderSent(primaryGuildId, tomorrowStr);
    console.log(`[Birthday] Sent reminders to ${sentCount} members for ${birthdayNames.join(', ')}'s birthday`);
}

// ─── Role removal (23:59) ────────────────────────────────────────────────────

async function removeExpiredRoles(ny) {
    const pending = bot.db.getPendingRoleRemovals(primaryGuildId, ny.month, ny.day);
    if (pending.length === 0) return;

    let guild;
    try {
        guild = await bot.client.guilds.fetch(primaryGuildId);
    } catch (err) {
        console.error('[Birthday] Could not fetch guild for role removal:', err.message);
        return;
    }

    for (const record of pending) {
        try {
            const member = await guild.members.fetch(record.user_id);
            await member.roles.remove(record.role_id);
            bot.db.markRoleRemoved(record.user_id, primaryGuildId, record.role_id);
            console.log(`[Birthday] Removed birthday role from ${record.user_id}`);
        } catch (err) {
            console.error(`[Birthday] Could not remove role from ${record.user_id}:`, err.message);
            // Still mark removed so we don't retry forever
            bot.db.markRoleRemoved(record.user_id, primaryGuildId, record.role_id);
        }
    }
}

// ─── /birthday command ───────────────────────────────────────────────────────

const birthdayCommand = {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Manage server birthdays (admins only)')
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Add or update a member\'s birthday')
            .addUserOption(o => o.setName('user').setDescription('Server member').setRequired(true))
            .addIntegerOption(o => o.setName('month').setDescription('Birth month (1–12)').setRequired(true).setMinValue(1).setMaxValue(12))
            .addIntegerOption(o => o.setName('day').setDescription('Birth day (1–31)').setRequired(true).setMinValue(1).setMaxValue(31))
            .addStringOption(o => o.setName('name').setDescription('Display name (e.g. Anna W). Defaults to Discord display name.').setRequired(false))
        )
        .addSubcommand(sub => sub
            .setName('remove')
            .setDescription('Remove a member\'s birthday')
            .addUserOption(o => o.setName('user').setDescription('Server member').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('List all saved birthdays')
        )
        .addSubcommand(sub => sub
            .setName('channel')
            .setDescription('Change the channel used for announcements and reminders')
            .addChannelOption(o => o.setName('channel').setDescription('The channel').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('message')
            .setDescription('Customize the happy birthday message. Use {mention} and {name}.')
            .addStringOption(o => o.setName('text').setDescription('New message template').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('reminder')
            .setDescription('Customize the DM reminder message. Use {name}.')
            .addStringOption(o => o.setName('text').setDescription('New reminder template').setRequired(true))
        )
        .addSubcommand(sub => sub
            .setName('preview')
            .setDescription('Preview the current birthday and reminder messages')
        )
        .addSubcommand(sub => sub
            .setName('testdm')
            .setDescription('Send a test DM reminder to the configured test user (BIRTHDAY_TEST_USER_ID)')
        ),

    async execute(interaction, botInstance) {
        // Permission check
        if (!BIRTHDAY_ADMINS.includes(interaction.user.id)) {
            return interaction.reply({
                content: '❌ You don\'t have permission to use this command.',
                ephemeral: true,
            });
        }

        const sub = interaction.options.getSubcommand();

        if (sub === 'set')      return handleSet(interaction);
        if (sub === 'remove')   return handleRemove(interaction);
        if (sub === 'list')     return handleList(interaction);
        if (sub === 'channel')  return handleChannel(interaction);
        if (sub === 'message')  return handleMessage(interaction);
        if (sub === 'reminder') return handleReminder(interaction);
        if (sub === 'preview')  return handlePreview(interaction);
        if (sub === 'testdm')   return handleTestDm(interaction);
    },
};

// ─── Subcommand handlers ──────────────────────────────────────────────────────

async function handleSet(interaction) {
    const user   = interaction.options.getUser('user');
    const month  = interaction.options.getInteger('month');
    const day    = interaction.options.getInteger('day');
    const nameOpt = interaction.options.getString('name');

    // Validate day for given month (use a non-leap year for simplicity, treat Feb 29 as valid)
    const daysInMonth = [0, 31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    if (day > daysInMonth[month]) {
        return interaction.reply({
            content: `❌ ${MONTHS[month - 1]} doesn't have ${day} days.`,
            ephemeral: true,
        });
    }

    // Resolve display name: provided > guild nickname > global display name
    let displayName = nameOpt;
    if (!displayName) {
        try {
            const member = await interaction.guild.members.fetch(user.id);
            displayName = member.displayName;
        } catch {
            displayName = user.displayName || user.username;
        }
    }

    bot.db.setBirthday(user.id, primaryGuildId, month, day, displayName);

    return interaction.reply({
        content: `✅ Birthday set: **${displayName}** — ${MONTHS[month - 1]} ${day}`,
        ephemeral: true,
    });
}

async function handleRemove(interaction) {
    const user = interaction.options.getUser('user');
    const removed = bot.db.removeBirthday(user.id, primaryGuildId);

    return interaction.reply({
        content: removed
            ? `✅ Removed birthday for <@${user.id}>.`
            : `⚠️ No birthday found for <@${user.id}>.`,
        ephemeral: true,
    });
}

async function handleList(interaction) {
    const birthdays = bot.db.getAllBirthdays(primaryGuildId);

    if (birthdays.length === 0) {
        return interaction.reply({ content: 'No birthdays saved yet.', ephemeral: true });
    }

    // Get today & tomorrow for highlighting
    const ny       = getNY();
    const tomorrow = getTomorrowNY();

    const lines = birthdays.map(b => {
        const isToday    = b.birth_month === ny.month && b.birth_day === ny.day;
        const isTomorrow = b.birth_month === tomorrow.month && b.birth_day === tomorrow.day;
        const flag = isToday ? ' 🎂 **TODAY**' : isTomorrow ? ' 🔔 tomorrow' : '';
        const name = b.display_name || `<@${b.user_id}>`;
        return `• **${name}** — ${MONTHS[b.birth_month - 1]} ${b.birth_day}${flag}`;
    });

    const embed = new EmbedBuilder()
        .setTitle('🎂 Server Birthdays')
        .setDescription(lines.join('\n'))
        .setColor(0xFF69B4)
        .setFooter({ text: `${birthdays.length} members • Times in New York (ET)` });

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleChannel(interaction) {
    const channel = interaction.options.getChannel('channel');
    bot.db.setBirthdaySetting(primaryGuildId, 'announcement_channel', channel.id);

    return interaction.reply({
        content: `✅ Birthday announcements will now go to <#${channel.id}>.`,
        ephemeral: true,
    });
}

async function handleMessage(interaction) {
    const text = interaction.options.getString('text');
    bot.db.setBirthdaySetting(primaryGuildId, 'birthday_message', text);

    return interaction.reply({
        content: `✅ Birthday message updated.\n\n**Preview:**\n${text.replace('{mention}', '@User').replace('{name}', 'User')}`,
        ephemeral: true,
    });
}

async function handleReminder(interaction) {
    const text = interaction.options.getString('text');
    bot.db.setBirthdaySetting(primaryGuildId, 'reminder_message', text);

    return interaction.reply({
        content: `✅ Reminder message updated.\n\n**Preview:**\n${text.replace('{name}', 'User')}`,
        ephemeral: true,
    });
}

async function handlePreview(interaction) {
    const bdayTemplate     = getSetting('birthday_message', DEFAULT_BIRTHDAY_MSG);
    const reminderTemplate = getSetting('reminder_message', DEFAULT_REMINDER_MSG);
    const channelId        = getSetting('announcement_channel', DEFAULT_CHANNEL);
    const roleId           = getSetting('birthday_role', DEFAULT_ROLE);

    const bdayPreview     = bdayTemplate.replace(/\{mention\}/g, '@User').replace(/\{name\}/g, 'User');
    const reminderPreview = reminderTemplate.replace(/\{name\}/g, 'User');

    const embed = new EmbedBuilder()
        .setTitle('🎂 Birthday Settings Preview')
        .setColor(0xFF69B4)
        .addFields(
            { name: '📢 Announcement Channel', value: `<#${channelId}>` },
            { name: '🎖️ Birthday Role', value: `<@&${roleId}>` },
            { name: '🎂 Birthday Message', value: bdayPreview },
            { name: '🔔 DM Reminder', value: reminderPreview },
        );

    return interaction.reply({ embeds: [embed], ephemeral: true });
}

async function handleTestDm(interaction) {
    await interaction.deferReply({ ephemeral: true });

    const TEST_USER_ID = config.birthday.testUserId;
    const template = getSetting('reminder_message', DEFAULT_REMINDER_MSG);

    // Pick a sample name for the preview (replace with a real name from your server if desired)
    const sampleName = 'Someone';
    const message = template.replace(/\{name\}/g, sampleName);

    try {
        const user = await bot.client.users.fetch(TEST_USER_ID);
        await user.send(message);
        return interaction.editReply({ content: `✅ Test DM sent to <@${TEST_USER_ID}>.` });
    } catch (err) {
        return interaction.editReply({ content: `❌ Failed to send DM: ${err.message}` });
    }
}

// ─── Permission check ─────────────────────────────────────────────────────────

async function checkPermissions() {
    for (const guild of bot.client.guilds.cache.values()) {
        const me = guild.members.me;
        if (!me) continue;

        if (!me.permissions.has(PermissionFlagsBits.ManageRoles)) {
            console.warn(`[Birthday] ⚠️  Missing MANAGE_ROLES permission in "${guild.name}"`);
        }

        const roleId = getSetting('birthday_role', DEFAULT_ROLE);
        try {
            const role = await guild.roles.fetch(roleId);
            if (role && me.roles.highest.comparePositionTo(role) <= 0) {
                console.warn(`[Birthday] ⚠️  Birthday role "${role.name}" is higher than or equal to the bot's highest role in "${guild.name}". Role assignment will fail.`);
            }
        } catch {
            console.warn(`[Birthday] ⚠️  Could not fetch birthday role ${roleId} in "${guild.name}"`);
        }
    }
}

// ─── Module lifecycle ─────────────────────────────────────────────────────────

export default {
    name: 'birthday',

    async init(botInstance) {
        bot = botInstance;

        // Resolve primary guild from the default announcement channel
        try {
            const channel = await bot.client.channels.fetch(DEFAULT_CHANNEL);
            primaryGuildId = channel?.guildId;
        } catch {
            primaryGuildId = bot.client.guilds.cache.first()?.id;
        }

        if (!primaryGuildId) {
            console.error('[Birthday] ❌ Could not determine primary guild ID. Module disabled.');
            return;
        }

        // Seed birthday data (won't overwrite existing entries)
        for (const { userId, name, month, day } of BIRTHDAY_SEED) {
            bot.db.seedBirthday(userId, primaryGuildId, month, day, name);
        }
        console.log(`[Birthday] Seeded ${BIRTHDAY_SEED.length} birthdays for guild ${primaryGuildId}`);

        // Check bot permissions
        await checkPermissions();

        // Register slash command
        bot.client.commands.set('birthday', birthdayCommand);

        // Start scheduler — checks every 60 seconds
        schedulerInterval = setInterval(runScheduler, 60 * 1000);

        // Run once shortly after init to catch up if bot restarted near a trigger time
        setTimeout(runScheduler, 5000);

        console.log('[Birthday] ✅ Module initialized');
    },

    async cleanup() {
        if (schedulerInterval) {
            clearInterval(schedulerInterval);
            schedulerInterval = null;
        }
    },
};
