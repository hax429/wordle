const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');

function createGuestRoutes(db, statsCalculator) {
    // Get all-time statistics
    router.get('/stats/all-time', (req, res) => {
        try {
            const stats = statsCalculator.getAllTimeStats();
            const rankings = statsCalculator.getRankings(stats);
            const facts = statsCalculator.getInterestingFacts();
            res.json({ stats, rankings, facts });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get last week statistics
    router.get('/stats/last-week', (req, res) => {
        try {
            const stats = statsCalculator.getLastWeekStats();
            const rankings = statsCalculator.getRankings(stats);

            // Get max day for last week calculation
            const maxDayRow = db.db.prepare('SELECT MAX(day) as max_day FROM streaks').get();
            const maxDay = maxDayRow?.max_day || 0;
            const startDay = Math.max(1, maxDay - 6);

            const facts = statsCalculator.getInterestingFacts(startDay, maxDay);
            res.json({ stats, rankings, facts });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get plot data
    router.get('/plot-data', (req, res) => {
        try {
            const plotData = statsCalculator.getPlotData();
            res.json(plotData);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Get database overview
    router.get('/overview', (req, res) => {
        try {
            const overview = db.getBriefOverview();
            res.json(overview);
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

    // List all days
    router.get('/days', (req, res) => {
        try {
            const days = db.listDays();
            res.json({ days });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // IMPORTANT: List available videos MUST come BEFORE the parameterized route
    // List available videos
    router.get('/videos', (req, res) => {
        try {
            const videosDir = path.join(__dirname, '../../videos');

            if (!fs.existsSync(videosDir)) {
                return res.json({ videos: [] });
            }

            const files = fs.readdirSync(videosDir);
            const videoFiles = files.filter(f => f.endsWith('.mp4'));

            const videos = videoFiles.map(filename => ({
                filename,
                url: `/api/videos/${filename}`,
                size: fs.statSync(path.join(videosDir, filename)).size
            }));

            res.json({ videos });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    });

    // Serve video files - This must come AFTER /videos to avoid conflicts
    router.get('/videos/:filename', (req, res) => {
        try {
            const videoPath = path.join(__dirname, '../../videos', req.params.filename);

            if (!fs.existsSync(videoPath)) {
                return res.status(404).json({ error: 'Video not found' });
            }

            // Set proper headers for video streaming
            const stat = fs.statSync(videoPath);
            const fileSize = stat.size;
            const range = req.headers.range;

            if (range) {
                // Handle range requests for seeking
                const parts = range.replace(/bytes=/, "").split("-");
                const start = parseInt(parts[0], 10);
                const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
                const chunksize = (end - start) + 1;
                const file = fs.createReadStream(videoPath, { start, end });
                const head = {
                    'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                    'Accept-Ranges': 'bytes',
                    'Content-Length': chunksize,
                    'Content-Type': 'video/mp4',
                };
                res.writeHead(206, head);
                file.pipe(res);
            } else {
                // No range request, send entire file
                const head = {
                    'Content-Length': fileSize,
                    'Content-Type': 'video/mp4',
                };
                res.writeHead(200, head);
                fs.createReadStream(videoPath).pipe(res);
            }
        } catch (error) {
            console.error('Error serving video:', error);
            res.status(500).json({ error: error.message });
        }
    });

    return router;
}

module.exports = createGuestRoutes;


