const express = require('express');
const router = express.Router();
const { verifyToken, login } = require('../middleware/auth');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

function createAdminRoutes(db, statsCalculator) {
    // Login endpoint (no auth required)
    router.post('/login', async (req, res) => {
        try {
            const { password } = req.body;
            
            if (!password) {
                return res.status(400).json({ error: 'Password required' });
            }

            const token = await login(password);
            res.json({ token, message: 'Login successful' });
        } catch (error) {
            res.status(401).json({ error: error.message });
        }
    });

    // All routes below require authentication
    router.use(verifyToken);

    // Verify token (check if still valid)
    router.get('/verify', (req, res) => {
        res.json({ valid: true, user: req.user });
    });

    // Import streak data
    router.post('/import', (req, res) => {
        try {
            const { message } = req.body;
            
            if (!message) {
                return res.status(400).json({ error: 'Message required' });
            }

            const result = db.addStreakData(message);
            res.json({ success: true, result });
        } catch (error) {
            res.status(400).json({ error: error.message });
        }
    });

    // Get all days
    router.get('/days', (req, res) => {
        try {
            const days = db.listDays();
            res.json({ days });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get specific day details
    router.get('/day/:day', (req, res) => {
        try {
            const day = parseInt(req.params.day);
            const dayDetails = db.getDayDetails(day);
            
            if (!dayDetails) {
                return res.status(404).json({ error: 'Day not found' });
            }
            
            res.json(dayDetails);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Delete specific day
    router.delete('/day/:day', (req, res) => {
        try {
            const day = parseInt(req.params.day);
            
            // Check if day exists
            const dayDetails = db.getDayDetails(day);
            if (!dayDetails) {
                return res.status(404).json({ error: 'Day not found' });
            }

            db.deleteDay(day);
            res.json({ success: true, message: `Day ${day} deleted` });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Clear entire database
    router.post('/clear', (req, res) => {
        try {
            const { confirm } = req.body;
            
            if (confirm !== 'DELETE ALL DATA') {
                return res.status(400).json({ error: 'Confirmation required' });
            }

            db.clearDatabase();
            res.json({ success: true, message: 'Database cleared' });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get database info
    router.get('/database-info', (req, res) => {
        try {
            const overview = db.getBriefOverview();
            const allDays = db.listDays();
            const users = db.getAllUsers();
            
            res.json({
                overview,
                total_days: allDays.length,
                day_range: allDays.length > 0 ? {
                    min: Math.min(...allDays),
                    max: Math.max(...allDays)
                } : null,
                users
            });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Generate video
    router.post('/video/generate', async (req, res) => {
        try {
            const { type = '2d', filename, fps = 3, windowSize = 6 } = req.body;
            
            const VideoGenerator = require('../utils/video');
            const generator = new VideoGenerator(db);
            
            const outputFile = filename || `wordle_${type}_${Date.now()}.mp4`;
            const outputPath = path.join(__dirname, '../../videos', outputFile);

            // Ensure videos directory exists
            const videosDir = path.dirname(outputPath);
            if (!fs.existsSync(videosDir)) {
                fs.mkdirSync(videosDir, { recursive: true });
            }

            console.log(`Starting video generation: ${type} - ${outputFile}`);

            // Generate video asynchronously
            generator.generateVideo(type, outputPath, { fps, windowSize })
                .then(() => {
                    console.log(`Video generation completed: ${outputFile}`);
                })
                .catch(err => {
                    console.error(`Video generation failed: ${err.message}`);
                });

            // Return immediately with success
            res.json({ 
                success: true, 
                message: 'Video generation started',
                filename: outputFile,
                url: `/api/videos/${outputFile}`,
                status: 'processing'
            });

        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Backup database
    router.get('/backup', (req, res) => {
        try {
            const backupDir = path.join(__dirname, '../../backups');
            if (!fs.existsSync(backupDir)) {
                fs.mkdirSync(backupDir, { recursive: true });
            }

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupFile = `wordle_backup_${timestamp}.db`;
            const backupPath = path.join(backupDir, backupFile);

            // Copy database file
            fs.copyFileSync(db.dbPath, backupPath);

            res.download(backupPath, backupFile);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

module.exports = createAdminRoutes;

