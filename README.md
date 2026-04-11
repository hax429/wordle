# BTSDBot

A unified Discord bot and Wordle stats web server for the BTSD server.

The service runs both components in a single Node.js process:

- **Discord bot** — anonymous messaging, Wordle result tracking, birthday announcements, and an April Fools message-translation mode.
- **Web server** — public Wordle leaderboard/stats dashboard + a password-protected admin panel.

---

## Features

### Bot modules

| Module | What it does |
|---|---|
| `messaging` | `/say` sends an anonymous webhook message; right-click → **Reply Anonymously** lets users reply anonymously to any message. All messages are logged privately to an admin channel. |
| `wordle` | Monitors a designated channel hourly, parses Wordle streak posts, and writes results to a SQLite database. Provides `/wordle-process` (manual trigger) and `/wordle-test` (channel connectivity check). |
| `birthday` | Sends a birthday announcement at midnight (ET), DM reminders the evening before, and assigns/removes a birthday role. Managed via `/birthday` subcommands. |
| `april-fools` | On April 1 (ET), intercepts all messages, translates them to a random language via Google Translate, and resends them anonymously. Toggled via `/service start` / `/service terminate`. |

### Web server

| Route | Description |
|---|---|
| `/` | Public Wordle stats dashboard |
| `/admin` | Password-protected admin panel (import data, manage entries, generate videos) |
| `/{year}` | Yearly review page (e.g. `/2025`), toggled by `YEARLY_REVIEW_ENABLED` |
| `/health` | JSON health check — database status and row counts |
| `/api/*` | Public stats API |
| `/api/admin/*` | Admin API (JWT-protected) |

---

## Prerequisites

- Node.js ≥ 18
- A Discord application with a bot token ([Discord Developer Portal](https://discord.com/developers/applications))
- The bot must have these intents enabled in the portal: **Server Members**, **Message Content**
- The bot must be invited to your server with `applications.commands` and `bot` scopes, and the following permissions: Send Messages, Manage Webhooks, Manage Roles, Read Message History

---

## Installation

```bash
git clone git@github.com:hax429/BTSDBot.git
cd BTSDBot
npm install
```

---

## Configuration

Copy the template and fill in your values:

```bash
cp .env.template .env
```

### Required variables

```env
# Discord bot token (from the Developer Portal → Bot tab)
DISCORD_BOT_TOKEN=

# Application / Client ID (Developer Portal → General Information)
DISCORD_CLIENT_ID=

# Channel ID where the bot posts anonymous message logs
LOG_CHANNEL_ID=

# Comma-separated Discord user IDs that can run admin bot commands
ADMIN_USER_IDS=
```

### Bot feature variables

```env
# Comma-separated list of modules to load
# Available: messaging, wordle, birthday, april-fools
ENABLED_MODULES=messaging,wordle,birthday,april-fools

# Inactivity timeout before a temporary webhook user is cleaned up (minutes)
TEMP_USER_INACTIVITY_MINUTES=30
TEMP_USER_CLEANUP_INTERVAL_MINUTES=5
```

### Wordle module

```env
# Channel ID of the Wordle results channel to monitor
WORDLE_CHANNEL_ID=

# Channel ID where the bot posts a confirmation embed after processing results
WORDLE_AUDIT_LOG_CHANNEL_ID=

# How often to poll for new Wordle messages (hours)
WORDLE_CHECK_INTERVAL_HOURS=1
```

### Birthday module

```env
# Comma-separated Discord user IDs allowed to use /birthday commands
BIRTHDAY_ADMIN_IDS=

# Default channel for birthday announcements
BIRTHDAY_DEFAULT_CHANNEL_ID=

# Role ID to assign on someone's birthday (removed at 23:59 ET)
BIRTHDAY_DEFAULT_ROLE_ID=

# Timezone for scheduling (IANA format)
BIRTHDAY_TIMEZONE=America/New_York

# User ID to receive test DMs from /birthday testdm
BIRTHDAY_TEST_USER_ID=
```

### April Fools module

```env
# Comma-separated Discord user IDs allowed to use /service start|terminate
APRIL_FOOLS_ADMIN_IDS=

# Channel IDs to exclude from message interception (comma-separated)
APRIL_FOOLS_EXCLUDED_CHANNEL_IDS=

# Languages to randomly translate messages into (ISO 639-1 codes, comma-separated)
APRIL_FOOLS_LANGUAGES=es,fr

# Google Cloud Translation API key
GOOGLE_TRANSLATE_API_KEY=
```

### Web server

```env
PORT=3000

# Bcrypt hash of the admin panel password — generate with: node scripts/gen-admin-hash.js
ADMIN_PASSWORD_HASH=

# Random secret for signing JWT tokens — use a long random string
JWT_SECRET=

# Toggle sections of the public stats page
visibility_plot=true
visibility_video=true
visibility_stats=true
visibility_hall_of_fame=true
visibility_2025=true
```

### Yearly review (optional)

```env
YEARLY_REVIEW_ENABLED=true
YEARLY_REVIEW_YEAR=2025
```

### Database paths (optional — defaults shown)

```env
BOT_DATABASE_PATH=./data/btsd.db
WORDLE_DATABASE_PATH=./data/wordle.db
```

---

## Admin password setup

The admin panel uses bcrypt + JWT. Generate the password hash before first run:

```bash
node -e "
import('bcrypt').then(b => b.hash('your-password-here', 10)).then(h => {
  console.log('ADMIN_PASSWORD_HASH=' + h);
});
"
```

Copy the printed value into `.env`.

Generate a random `JWT_SECRET`:

```bash
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(32).toString('hex'))"
```

---

## Running

```bash
# Start both bot and web server together (recommended)
npm start

# Start only the bot
npm run bot

# Start only the web server
npm run server

# Development mode (auto-restart on file changes)
npm run dev

# Smoke test (verifies config and database connectivity without connecting to Discord)
npm test
```

---

## Bot commands

### Messaging

| Command | Who | Description |
|---|---|---|
| `/say <message>` | Everyone | Send an anonymous message in the current channel |
| Right-click message → **Reply Anonymously** | Everyone | Send an anonymous reply to a specific message |

### Wordle

| Command | Admins | Description |
|---|---|---|
| `/wordle-process` | ✓ | Manually trigger a check for unprocessed Wordle messages |
| `/wordle-test` | ✓ | Verify the bot can access the Wordle channel and shows recent messages |

### Birthday

All `/birthday` subcommands are restricted to `BIRTHDAY_ADMIN_IDS`.

| Subcommand | Description |
|---|---|
| `/birthday set <user> <month> <day> [name]` | Add or update a member's birthday |
| `/birthday remove <user>` | Remove a member's birthday |
| `/birthday list` | List all saved birthdays, highlighting today and tomorrow |
| `/birthday channel <channel>` | Change the announcement channel |
| `/birthday message <text>` | Customise the birthday announcement (use `{mention}` and `{name}`) |
| `/birthday reminder <text>` | Customise the DM reminder template (use `{name}`) |
| `/birthday preview` | Preview current message templates and settings |
| `/birthday testdm` | Send a test reminder DM to `BIRTHDAY_TEST_USER_ID` |

### April Fools

| Command | Admins | Description |
|---|---|---|
| `/service start` | ✓ | Activate April Fools mode (auto-activates on April 1 ET) |
| `/service terminate` | ✓ | Deactivate April Fools mode |

---

## Project structure

```
BTSDBot/
├── index.js                  # Entry point — starts both bot and server
├── package.json
│
├── bot/
│   ├── index.js              # BTSDBot class — client setup, module loader, command sync
│   └── modules/
│       ├── messaging.js      # /say + Reply Anonymously
│       ├── wordle.js         # Wordle channel monitor + slash commands
│       ├── birthday.js       # Birthday scheduler + /birthday command
│       └── april-fools.js    # Message translation + /service command
│
├── server/
│   ├── index.js              # Express app — static files, routes, health check
│   ├── database.js           # Legacy CJS database class (reference only, not used)
│   ├── setup.js              # Interactive admin password setup wizard (CJS, legacy)
│   ├── middleware/
│   │   └── auth.js           # JWT verify + bcrypt login
│   ├── routes/
│   │   ├── guest.js          # Public stats API (/api/*)
│   │   ├── admin.js          # Admin API (/api/admin/*, JWT-protected)
│   │   ├── yearly-review.js  # Yearly review API
│   │   └── 2025.js           # 2025-specific data route
│   └── utils/
│       ├── parser.js         # Wordle message text parser (legacy import path)
│       ├── stats.js          # Stats calculation helpers
│       ├── video.js          # Video generation utility
│       └── check_db.js       # Dev utility: prints database row counts
│
├── shared/
│   ├── config.js             # Unified config object (reads all .env values)
│   ├── bot-database.js       # BotDatabase class (messages, blocks, birthdays, wordle tracking)
│   ├── wordle-database.js    # WordleDatabase class (users, streaks, results, display names)
│   ├── logger.js             # Discord embed builders for admin log channel
│   └── webhooks.js           # Webhook create/cache/send helpers
│
├── public/                   # Static frontend (served by Express)
│   ├── index.html            # Public Wordle stats page
│   ├── admin.html            # Admin panel
│   ├── yearly-review.html    # Yearly review page
│   ├── css/
│   └── js/
│
├── data/                     # SQLite databases (gitignored)
│   ├── btsd.db               # Bot database (messages, birthdays, blocks)
│   └── wordle.db             # Wordle results database
│
├── tests/
│   └── test.js               # Smoke test (config + database connectivity)
│
└── .env.template             # Copy to .env and fill in your values
```

---

## How Wordle tracking works

1. The bot polls the configured Wordle channel every `WORDLE_CHECK_INTERVAL_HOURS` hours (and once on startup after 1 minute).
2. It looks for messages containing a Wordle streak summary (matching the pattern posted by the BTSD Wordle bot).
3. For each message, it extracts the streak day number, each user's score, and whether they were the day's winner (lowest score).
4. Results are written to `wordle.db` and a confirmation embed is posted to the audit log channel.
5. The bot keeps a pointer to the last processed message ID so it never double-counts.
6. Discord display names are synced from the guild on every check so the stats dashboard always shows current names.

---

## License

MIT
