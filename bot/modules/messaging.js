import { SlashCommandBuilder, ContextMenuCommandBuilder, ApplicationCommandType, ActionRowBuilder, ButtonBuilder, ButtonStyle, ModalBuilder, TextInputBuilder, TextInputStyle, EmbedBuilder } from 'discord.js';
import { config } from '../../shared/config.js';
import { getOrCreateWebhook, sendWebhookMessage } from '../../shared/webhooks.js';
import { logToAdminChannel, createAnonymousMessageEmbed } from '../../shared/logger.js';

/**
 * Messaging Module
 * Handles anonymous messaging via /say command and Reply Anonymously context menu
 */

let bot = null;

/**
 * /say command - Send anonymous message
 */
const sayCommand = {
    data: new SlashCommandBuilder()
        .setName('say')
        .setDescription('Send an anonymous message (visible to everyone)')
        .addStringOption(option =>
            option.setName('message')
                .setDescription('The message you want to send anonymously')
                .setRequired(true)
        ),

    async execute(interaction, botInstance) {
        const user = interaction.user;
        const guild = interaction.guild;
        const channel = interaction.channel;
        const message = interaction.options.getString('message');

        await interaction.deferReply({ ephemeral: true });

        try {
            const isBlocked = botInstance.db.isUserBlocked(user.id);
            if (isBlocked) {
                await interaction.followUp({ content: '❌ You are blocked from using this bot.', ephemeral: true });
                return;
            }

            if (!message || message.trim().length === 0) {
                await interaction.followUp({ content: '❌ Message cannot be empty.', ephemeral: true });
                return;
            }

            if (message.length > 2000) {
                await interaction.followUp({ content: `❌ Message is too long (${message.length} chars).`, ephemeral: true });
                return;
            }

            const webhookInfo = await getOrCreateWebhook(channel, 'Anonymous');
            if (!webhookInfo) {
                await interaction.followUp({ content: '❌ Failed to create webhook.', ephemeral: true });
                return;
            }

            const sentMessage = await sendWebhookMessage(webhookInfo.url, message, 'Anonymous', null);

            if (!sentMessage) {
                await interaction.followUp({ content: '❌ Failed to send message.', ephemeral: true });
                return;
            }

            await interaction.followUp({ content: '✅ Your anonymous message has been sent!', ephemeral: true });

            setImmediate(async () => {
                try {
                    const embed = createAnonymousMessageEmbed(user, guild, channel, message);
                    botInstance.db.logMessage(user.id, user.tag, guild.id, channel.id, message, 'anonymous', user.displayName, sentMessage.id);
                    await logToAdminChannel(botInstance, config.discord.logChannelId, embed);
                } catch (error) {
                    console.error('[Messaging] Error in logging:', error);
                }
            });

        } catch (error) {
            console.error('[Messaging] Error in /say:', error);
            await interaction.followUp({ content: '❌ An error occurred.', ephemeral: true });
        }
    }
};

/**
 * Reply Anonymously context menu command
 */
const replyCommand = {
    data: new ContextMenuCommandBuilder()
        .setName('Reply Anonymously')
        .setType(ApplicationCommandType.Message),

    async execute(interaction, botInstance) {
        const isBlocked = botInstance.db.isUserBlocked(interaction.user.id);
        if (isBlocked) {
            await interaction.reply({ content: '❌ You are blocked.', ephemeral: true });
            return;
        }

        const modal = new ModalBuilder()
            .setCustomId(`reply_modal_${interaction.targetMessage.id}`)
            .setTitle('Reply Anonymously');

        const replyInput = new TextInputBuilder()
            .setCustomId('reply_content')
            .setLabel('Your Reply')
            .setStyle(TextInputStyle.Paragraph)
            .setPlaceholder('Type your anonymous reply here...')
            .setMaxLength(2000)
            .setRequired(true);

        modal.addComponents(new ActionRowBuilder().addComponents(replyInput));
        await interaction.showModal(modal);
    }
};

/**
 * Handle button interactions
 */


/**
 * Handle modal submissions
 */
async function handleModalSubmit(interaction, botInstance) {
    if (interaction.customId.startsWith('reply_modal_')) {
        const messageId = interaction.customId.replace('reply_modal_', '');
        const replyContent = interaction.fields.getTextInputValue('reply_content');

        const user = interaction.user;
        const guild = interaction.guild;
        const channel = interaction.channel;

        await interaction.deferReply({ ephemeral: true });

        try {
            const isBlocked = botInstance.db.isUserBlocked(user.id);
            if (isBlocked) {
                await interaction.followUp({ content: '❌ You are blocked.', ephemeral: true });
                return;
            }

            let originalMessage;
            try {
                originalMessage = await channel.messages.fetch(messageId);
            } catch (error) {
                await interaction.followUp({ content: '❌ Could not find original message.', ephemeral: true });
                return;
            }

            const webhookInfo = await getOrCreateWebhook(channel, 'Anonymous');
            if (!webhookInfo) {
                await interaction.followUp({ content: '❌ Failed to create webhook.', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setDescription(originalMessage.content.substring(0, 500) + (originalMessage.content.length > 500 ? '...' : ''))
                .setColor(0xd3d3d3)
                .setAuthor({
                    name: `Replying to ${originalMessage.author.displayName || originalMessage.author.username}`,
                    iconURL: originalMessage.author.displayAvatarURL()
                })
                .addFields({ name: 'Original Message', value: `[Jump to Message](${originalMessage.url})` });

            if (originalMessage.attachments.size > 0) {
                const firstAttachment = originalMessage.attachments.first();
                if (firstAttachment.contentType?.startsWith('image/')) {
                    embed.setImage(firstAttachment.url);
                }
            }

            const sentMessage = await sendWebhookMessage(webhookInfo.url, replyContent, 'Anonymous', null, { embeds: [embed] });

            if (!sentMessage) {
                await interaction.followUp({ content: '❌ Failed to send reply.', ephemeral: true });
                return;
            }

            await interaction.followUp({ content: '✅ Reply sent!', ephemeral: true });

            setImmediate(async () => {
                try {
                    const logEmbed = createAnonymousMessageEmbed(user, guild, channel, replyContent);
                    logEmbed.addFields({ name: 'Replying To', value: `[Jump](${originalMessage.url}) (ID: ${originalMessage.id})` });
                    botInstance.db.logMessage(user.id, user.tag, guild.id, channel.id, replyContent, 'anonymous_reply', user.displayName, sentMessage.id);
                    await logToAdminChannel(botInstance, config.discord.logChannelId, logEmbed);
                } catch (error) {
                    console.error('[Messaging] Error in reply logging:', error);
                }
            });

        } catch (error) {
            console.error('[Messaging] Error in reply modal:', error);
            await interaction.followUp({ content: '❌ Error sending reply.', ephemeral: true });
        }
    }
}

/**
 * Module initialization
 */
export default {
    name: 'messaging',

    async init(botInstance) {
        bot = botInstance;
        console.log('[Messaging] Initializing module...');

        bot.client.commands.set('say', sayCommand);
        bot.client.commands.set('Reply Anonymously', replyCommand);

        bot.client.on('interactionCreate', async (interaction) => {
            try {
                if (interaction.isModalSubmit()) {
                    await handleModalSubmit(interaction, botInstance);
                } else if (interaction.isMessageContextMenuCommand()) {
                    const command = bot.client.commands.get(interaction.commandName);
                    if (command) {
                        await command.execute(interaction, botInstance);
                    }
                }
            } catch (error) {
                console.error('[Messaging] Error handling interaction:', error);
            }
        });

        console.log('[Messaging] ✅ Module initialized with reply functionality');
    },

    async cleanup() {
        console.log('[Messaging] Cleaning up module...');
    }
};
