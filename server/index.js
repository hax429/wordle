import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';

import WordleDatabase from '../shared/wordle-database.js';
import StatsCalculator from './utils/stats.js';
import createGuestRoutes from './routes/guest.js';
import createAdminRoutes from './routes/admin.js';
import createYearlyReviewRoutes from './routes/yearly-review.js';
import { config } from '../shared/config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database (singleton instance or passed in)
// Note: In unified service, we might want to pass the DB instance, 
// but for now creating new instance is fine as sqlite handles concurrency reasonably well
// or better yet, we can export logic to accept db instance if needed.
// For now, let's keep it creating its own instance to match structure, 
// as BotDatabase and WordleDatabase are separate classes.
const db = new WordleDatabase();
const statsCalculator = new StatsCalculator(db);

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting for login endpoint
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 requests per window
    message: 'Too many login attempts, please try again later'
});

// Serve static files from public directory
const publicPath = path.join(__dirname, '../public');
app.use(express.static(publicPath));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(publicPath, 'index.html'));
});

// Serve admin.html BEFORE mounting admin API routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(publicPath, 'admin.html'));
});

// API Routes
app.use('/api', createGuestRoutes(db, statsCalculator));
app.use('/api/admin', createAdminRoutes(db, statsCalculator));
app.use('/api/yearly-review', createYearlyReviewRoutes(db));

// Serve yearly review page at /{year} (e.g. /2025, /2026)
app.get(`/${config.yearlyReview.year}`, (req, res) => {
    if (!config.yearlyReview.enabled) {
        return res.redirect('/');
    }
    res.sendFile(path.join(publicPath, 'yearly-review.html'));
});

// Apply rate limiting to login
app.post('/api/admin/login', loginLimiter);

// Health check endpoint
app.get('/health', (req, res) => {
    try {
        const overview = db.getBriefOverview();
        res.json({
            status: 'healthy',
            database: 'connected',
            stats: {
                days: overview.total_streaks,
                users: overview.total_users,
                entries: overview.total_entries
            }
        });
    } catch (error) {
        res.status(500).json({
            status: 'unhealthy',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Not found' });
});

// Export start function
export function startServer() {
    return new Promise((resolve, reject) => {
        const server = app.listen(PORT, () => {
            console.log(`🎯 Wordle Stats Server running on port ${PORT}`);
            console.log(`📊 Public view: http://localhost:${PORT}`);
            console.log(`🔒 Admin console: http://localhost:${PORT}/admin`);
            console.log(`💚 Health check: http://localhost:${PORT}/health`);

            // Display database info
            try {
                const overview = db.getBriefOverview();
                console.log(`\n📈 Database Overview:`);
                console.log(`   • ${overview.total_streaks} days`);
                console.log(`   • ${overview.total_users} users`);
                console.log(`   • ${overview.total_entries} entries`);
            } catch (error) {
                console.warn('⚠️  Could not load database stats');
            }
            resolve(server);
        });

        server.on('error', (err) => {
            reject(err);
        });
    });
}

// Allow running directly
if (import.meta.url === `file://${process.argv[1]}`) {
    startServer();
}

export default app;

