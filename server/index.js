require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');

const WordleDatabase = require('./database');
const StatsCalculator = require('./utils/stats');
const createGuestRoutes = require('./routes/guest');
const createAdminRoutes = require('./routes/admin');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize database and stats calculator
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
app.use(express.static(path.join(__dirname, '../public')));

// Serve index.html for root path
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Serve admin.html BEFORE mounting admin API routes
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/admin.html'));
});

// API Routes
app.use('/api', createGuestRoutes(db, statsCalculator));
app.use('/api/admin', createAdminRoutes(db, statsCalculator));

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

// Start server
app.listen(PORT, () => {
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
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, closing database...');
    db.close();
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('\nSIGINT received, closing database...');
    db.close();
    process.exit(0);
});

module.exports = app;

