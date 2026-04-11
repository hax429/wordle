import { EmbedBuilder } from 'discord.js';

/**
 * Send embed to admin log channel
 */
export async function logToAdminChannel(bot, channelId, embed) {
    try {
        const channel = await bot.client.channels.fetch(channelId);

        if (!channel || !channel.isTextBased()) {
            console.error(`[Logger] Admin channel ${channelId} not found or not a text channel`);
            return null;
        }

        return await channel.send({ embeds: [embed] });

    } catch (error) {
        console.error('[Logger] Error sending to admin channel:', error.message);
        return null;
    }
}

/**
 * Create embed for anonymous message logging
 */
export function createAnonymousMessageEmbed(user, guild, channel, messageContent) {
    const embed = new EmbedBuilder()
        .setTitle('📝 Anonymous Message Sent')
        .setDescription('━━━━━━━━━━━━━━━━━━━━')
        .setColor(0x0099ff)
        .setTimestamp()
        .addFields(
            { name: 'User', value: `${user} (${user.tag})`, inline: false },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Server', value: guild.name, inline: true },
            { name: 'Message', value: messageContent.substring(0, 1000), inline: false }
        );

    if (messageContent.length > 1000) {
        embed.setFooter({ text: 'Message truncated (too long)' });
    }

    return embed;
}

/**
 * Create embed for temporary user creation
 */
export function createTempUserCreatedEmbed(user, guild, channel, displayName, avatarUrl = null) {
    const embed = new EmbedBuilder()
        .setTitle('👤 Temporary User Created')
        .setDescription('━━━━━━━━━━━━━━━━━━━━')
        .setColor(0x00ff00)
        .setTimestamp()
        .addFields(
            { name: 'Real User', value: `${user} (${user.tag})`, inline: false },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Display Name', value: displayName, inline: true },
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Server', value: guild.name, inline: false }
        );

    if (avatarUrl) {
        embed.addFields({ name: 'Avatar URL', value: avatarUrl.substring(0, 100), inline: false });
        embed.setThumbnail(avatarUrl);
    }

    return embed;
}

/**
 * Create embed for temporary user deletion
 */
export function createTempUserDeletedEmbed(user, guild, channel, displayName, reason = 'User quit') {
    const embed = new EmbedBuilder()
        .setTitle('❌ Temporary User Deleted')
        .setDescription('━━━━━━━━━━━━━━━━━━━━')
        .setColor(0xff0000)
        .setTimestamp()
        .addFields(
            { name: 'Real User', value: `${user} (${user.tag})`, inline: false },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Display Name', value: displayName, inline: true },
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Reason', value: reason, inline: false }
        );

    return embed;
}

/**
 * Create embed for webhook message logging
 */
export function createWebhookMessageEmbed(user, guild, channel, displayName, messageContent) {
    const embed = new EmbedBuilder()
        .setTitle('💬 Webhook Message Sent')
        .setDescription('━━━━━━━━━━━━━━━━━━━━')
        .setColor(0x9b59b6)
        .setTimestamp()
        .addFields(
            { name: 'Real User', value: `${user} (${user.tag})`, inline: false },
            { name: 'User ID', value: user.id, inline: true },
            { name: 'Display Name', value: displayName, inline: true },
            { name: 'Channel', value: `${channel}`, inline: true },
            { name: 'Message', value: messageContent.substring(0, 1000), inline: false }
        );

    if (messageContent.length > 1000) {
        embed.setFooter({ text: 'Message truncated (too long)' });
    }

    return embed;
}
