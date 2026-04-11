/**
 * Webhook Management Utilities
 * Handles webhook creation, deletion, and message sending
 */

/**
 * Get or create a webhook for a channel
 */
export async function getOrCreateWebhook(channel, webhookName = 'BTSD Anonymous') {
    try {
        // Get existing webhooks in channel
        const webhooks = await channel.fetchWebhooks();

        // Look for our webhook (must have a token — webhooks created by other bots won't)
        const existing = webhooks.find(wh => wh.name === webhookName && wh.token);
        if (existing) {
            console.log(`[Webhook] Found existing webhook in #${channel.name}: ${existing.id}`);
            return {
                id: existing.id,
                token: existing.token,
                url: existing.url
            };
        }

        // Create new webhook
        console.log(`[Webhook] Creating new webhook in #${channel.name}`);
        const webhook = await channel.createWebhook({
            name: webhookName,
            reason: 'Bot webhook for anonymous/temporary user messages'
        });

        return {
            id: webhook.id,
            token: webhook.token,
            url: webhook.url
        };

    } catch (error) {
        console.error(`[Webhook] Error managing webhook in #${channel.name}:`, error.message);
        return null;
    }
}

/**
 * Send a message via webhook
 */
export async function sendWebhookMessage(webhookUrl, content, username, avatarUrl = null, options = {}) {
    try {
        const { WebhookClient } = await import('discord.js');
        const webhook = new WebhookClient({ url: webhookUrl });

        const message = await webhook.send({
            content,
            username,
            avatarURL: avatarUrl,
            ...options
        });

        console.log(`[Webhook] Sent message as '${username}'`);
        return message;

    } catch (error) {
        console.error('[Webhook] Error sending webhook message:', error.message);
        return null;
    }
}

/**
 * Delete a webhook
 */
export async function deleteWebhook(webhookId, webhookToken) {
    try {
        const { WebhookClient } = await import('discord.js');
        const webhook = new WebhookClient({ id: webhookId, token: webhookToken });

        await webhook.delete();
        console.log(`[Webhook] Deleted webhook ${webhookId}`);
        return true;

    } catch (error) {
        if (error.code === 10015) { // Unknown Webhook
            console.log(`[Webhook] Webhook ${webhookId} already deleted`);
            return true;
        }
        console.error('[Webhook] Error deleting webhook:', error.message);
        return false;
    }
}
