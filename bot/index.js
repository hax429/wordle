import { Client, GatewayIntentBits, Collection, ActivityType } from 'discord.js';
import { config } from '../shared/config.js';
import { BotDatabase } from '../shared/bot-database.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { readdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * BTSD Discord Bot
 * Main bot class with all functionality
 */
export class BTSDBot {
    constructor() {
        // Create Discord client with required intents
        this.client = new Client({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.MessageContent,
            ],
        });

        // Initialize database
        this.db = new BotDatabase();

        // Collections for commands and modules
        this.client.commands = new Collection();
        this.modules = new Collection();

        // Store config reference
        this.config = config;

        // Setup event handlers
        this.setupEventHandlers();
    }

    /**
     * Setup core event handlers
     */
    setupEventHandlers() {
        // Ready event
        this.client.once('ready', async () => {
            console.log('='.repeat(50));
            console.log(`✅ Bot is ready!`);
            console.log(`📝 Logged in as: ${this.client.user.tag}`);
            console.log(`🆔 Bot ID: ${this.client.user.id}`);
            console.log(`🏠 Connected to ${this.client.guilds.cache.size} guild(s)`);
            console.log('='.repeat(50));

            // Set bot status
            this.client.user.setActivity('over the server', { type: ActivityType.Watching });

            // Load modules first to populate commands
            await this.loadModules();

            // Display configuration
            console.log(config.display());

            // Sync commands to guilds (Guild-only strategy)
            await this.syncCommands();

            console.log('✅ Bot initialization complete!');
        });

        // Error handling
        this.client.on('error', (error) => {
            console.error('Discord client error:', error);
        });

        // Interaction handling
        this.client.on('interactionCreate', async (interaction) => {
            if (!interaction.isChatInputCommand() && !interaction.isMessageContextMenuCommand()) return;

            console.log(`[Interaction] Received command: ${interaction.commandName} from ${interaction.user.tag}`);
            const command = this.client.commands.get(interaction.commandName);

            if (!command) {
                console.warn(`Unknown command: ${interaction.commandName}`);
                return;
            }

            try {
                await command.execute(interaction, this);
            } catch (error) {
                console.error(`Error executing command ${interaction.commandName}:`, error);
                const errorMessage = '❌ An error occurred while executing this command.';
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: errorMessage, ephemeral: true });
                } else {
                    await interaction.reply({ content: errorMessage, ephemeral: true });
                }
            }
        });
    }

    /**
     * Sync slash commands to all guilds (Guild-only strategy)
     */
    async syncCommands() {
        console.log('🔄 Syncing commands to guilds...');

        const commandsData = Array.from(this.client.commands.values()).map(cmd => cmd.data);

        for (const guild of this.client.guilds.cache.values()) {
            try {
                // Set commands (overwrites existing, removes unused)
                await guild.commands.set(commandsData);
                console.log(`   ✅ Synced ${commandsData.length} commands to ${guild.name}`);
            } catch (error) {
                console.error(`   ❌ Failed to sync commands to ${guild.name}:`, error.message);
            }
        }

        // Clear global commands to avoid duplicates
        try {
            await this.client.application.commands.set([]);
            console.log('   ✅ Cleared global commands');
        } catch (error) {
            console.error('   ❌ Failed to clear global commands:', error.message);
        }

        console.log('✅ Command sync complete');
    }

    /**
     * Load all bot modules
     */
    async loadModules() {
        const enabledModules = config.bot.enabledModules;
        console.log(`📦 Loading modules: ${enabledModules.join(', ')}`);

        for (const moduleName of enabledModules) {
            try {
                const modulePath = join(__dirname, 'modules', `${moduleName}.js`);
                const module = await import(modulePath);

                // Initialize module
                if (module.default && typeof module.default.init === 'function') {
                    await module.default.init(this);
                    this.modules.set(moduleName, module.default);
                    console.log(`   ✅ Loaded module: ${moduleName}`);
                } else {
                    console.warn(`   ⚠️  Module ${moduleName} has no init function`);
                }
            } catch (error) {
                console.error(`   ❌ Failed to load module ${moduleName}:`, error.message);
            }
        }

        console.log(`✅ Loaded ${this.modules.size} modules`);
    }

    /**
     * Start the bot
     */
    async start() {
        try {
            // Validate configuration
            config.validate();
            console.log('✅ Configuration validated');

            // Login to Discord
            console.log('🔐 Logging in to Discord...');
            await this.client.login(config.discord.token);
        } catch (error) {
            console.error('❌ Failed to start bot:', error);
            process.exit(1);
        }
    }

    /**
     * Graceful shutdown
     */
    async shutdown() {
        console.log('🛑 Shutting down bot...');

        // Cleanup modules
        for (const [name, module] of this.modules) {
            if (module.cleanup && typeof module.cleanup === 'function') {
                try {
                    await module.cleanup();
                    console.log(`   ✅ Cleaned up module: ${name}`);
                } catch (error) {
                    console.error(`   ❌ Error cleaning up module ${name}:`, error);
                }
            }
        }

        // Close database
        this.db.close();
        console.log('   ✅ Database closed');

        // Destroy Discord client
        this.client.destroy();
        console.log('   ✅ Discord client destroyed');

        console.log('✅ Shutdown complete');
    }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
    console.log('\n📡 Received SIGINT signal');
    if (global.bot) {
        await global.bot.shutdown();
    }
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n📡 Received SIGTERM signal');
    if (global.bot) {
        await global.bot.shutdown();
    }
    process.exit(0);
});

// Start bot if this is the main module
if (import.meta.url === `file://${process.argv[1]}`) {
    const bot = new BTSDBot();
    global.bot = bot;
    bot.start();
}

export default BTSDBot;
