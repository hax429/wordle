import PImage from 'pureimage';
import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default class VideoGenerator {
    constructor(db) {
        this.db = db;
        // Wordle Colors
        this.colors = {
            green: '#538d4e',
            yellow: '#b59f3b',
            gray: '#3a3a3c',
            dark: '#121213',
            text: '#ffffff',
            textSecondary: '#818384',
            border: '#3a3a3c'
        };

        // Register Font
        this.fontLoaded = false;
        try {
            const fontPath = path.join(__dirname, '../fonts/OpenSans-Regular.ttf');
            if (fs.existsSync(fontPath)) {
                this.font = PImage.registerFont(fontPath, 'OpenSans');
            } else {
                console.warn('Font file not found:', fontPath);
            }
        } catch (e) {
            console.error('Error registering font:', e);
        }
    }

    async ensureFontLoaded() {
        if (this.fontLoaded || !this.font) return;
        return new Promise((resolve) => {
            this.font.load(() => {
                this.fontLoaded = true;
                resolve();
            });
        });
    }

    getUserDataOverTime() {
        const query = `
            SELECT s.day, u.user_id, r.score
            FROM results r
            JOIN users u ON r.user_id = u.id
            JOIN streaks s ON r.streak_day = s.day
            ORDER BY s.day, u.user_id
        `;

        const rows = this.db.db.prepare(query).all();
        const userData = {};
        const allDays = new Set();
        const dayAverages = {};

        // First pass: Organize data
        for (const row of rows) {
            if (!userData[row.user_id]) {
                userData[row.user_id] = [];
            }
            const numericScore = row.score === 'X' ? 7 : parseInt(row.score);
            userData[row.user_id].push({ day: row.day, score: numericScore, rawScore: row.score });
            allDays.add(row.day);

            if (!dayAverages[row.day]) dayAverages[row.day] = { sum: 0, count: 0 };
            dayAverages[row.day].sum += numericScore;
            dayAverages[row.day].count++;
        }

        const sortedDays = Array.from(allDays).sort((a, b) => a - b);

        // Calculate final day averages
        for (const day of sortedDays) {
            if (dayAverages[day]) {
                dayAverages[day].avg = (dayAverages[day].sum / dayAverages[day].count).toFixed(2);
            }
        }

        return {
            userData,
            sortedDays,
            dayAverages,
            allUsers: Object.keys(userData)
        };
    }

    async generateVideo(type, outputPath, options = {}) {
        if (type === '2d' || type === '3d') {
            // We are replacing the old 2D/3D logic with the new Leaderboard Race
            return await this.generateLeaderboardVideo(outputPath, options);
        } else {
            throw new Error(`Unknown video type: ${type}`);
        }
    }

    async generateLeaderboardVideo(outputPath, options = {}) {
        await this.ensureFontLoaded();

        const fps = options.fps || 3; // Default to 3 for readability
        const width = 1920;
        const height = 1080;

        console.log('📊 Extracting data...');
        const data = this.getUserDataOverTime();

        if (data.sortedDays.length === 0) {
            throw new Error('No data available to generate video');
        }

        console.log(`🎬 Generating ${data.sortedDays.length} frames...`);

        const framesDir = path.join(path.dirname(outputPath), 'frames_temp');
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        // Generate frames
        for (let frameIdx = 0; frameIdx < data.sortedDays.length; frameIdx++) {
            const currentDay = data.sortedDays[frameIdx];
            const canvas = PImage.make(width, height);
            const ctx = canvas.getContext('2d');

            // 1. Calculate Stats for this Day
            const currentStats = [];
            for (const user of data.allUsers) {
                const history = data.userData[user].filter(d => d.day <= currentDay);
                if (history.length === 0) continue;

                const sum = history.reduce((acc, curr) => acc + curr.score, 0);
                const avg = sum / history.length;
                const lastScore = history[history.length - 1];
                const recentHistory = history.slice(-5);

                currentStats.push({
                    username: user,
                    average: avg,
                    gamesPlayed: history.length,
                    todayScore: lastScore.day === currentDay ? lastScore : null,
                    recentHistory
                });
            }

            // Sort by Average (Lower is better)
            currentStats.sort((a, b) => a.average - b.average);

            // 2. Draw Frame
            this.drawFrame(ctx, width, height, currentDay, data.dayAverages[currentDay], currentStats);

            // Save frame
            const framePath = path.join(framesDir, `frame${frameIdx.toString().padStart(5, '0')}.png`);
            await this.saveFrame(canvas, framePath);

            if ((frameIdx + 1) % 10 === 0) {
                console.log(`  Generated ${frameIdx + 1}/${data.sortedDays.length} frames`);
            }
        }

        console.log('🎞️  Encoding video with ffmpeg...');
        await this.encodeVideo(framesDir, outputPath, fps);

        console.log('🧹 Cleaning up temporary files...');
        fs.rmSync(framesDir, { recursive: true, force: true });

        console.log(`✅ Video generated: ${outputPath}`);
        return outputPath;
    }

    saveFrame(canvas, filepath) {
        return new Promise((resolve, reject) => {
            const stream = fs.createWriteStream(filepath);
            PImage.encodePNGToStream(canvas, stream).then(() => {
                resolve();
            }).catch((e) => {
                reject(e);
            });
        });
    }

    drawFrame(ctx, width, height, day, dayStats, userStats) {
        // Background - PureImage might not support gradients well, sticking to solid for safety or simple fill
        ctx.fillStyle = this.colors.dark;
        ctx.fillRect(0, 0, width, height);

        // Header
        ctx.fillStyle = this.colors.text;
        ctx.font = "60pt OpenSans"; // PureImage font format
        ctx.textAlign = 'center';
        ctx.fillText(`WORDLE LEADERBOARD`, width / 2, 80);

        ctx.font = "40pt OpenSans";
        ctx.fillStyle = this.colors.textSecondary;
        ctx.fillText(`Day ${day}`, width / 2, 140);

        // Day Average Badge
        if (dayStats) {
            const avgText = `Day Average: ${dayStats.avg}`;
            ctx.font = "30pt OpenSans";
            ctx.fillStyle = this.colors.green;
            ctx.fillText(avgText, width / 2, 190);
        }

        // Leaderboard Config
        const startY = 250;
        const rowHeight = 100;
        const maxRows = 7; // Show top 7
        const padding = 200;
        const barWidth = width - (padding * 2);

        // Draw Rows
        userStats.slice(0, maxRows).forEach((stat, index) => {
            const y = startY + (index * rowHeight);

            // Row Background
            if (index % 2 === 0) {
                ctx.fillStyle = '#1a1a1b'; // Fallback for rgba
                ctx.fillRect(padding - 20, y - 60, barWidth + 40, rowHeight - 10);
            }

            // Rank
            ctx.fillStyle = index === 0 ? '#ffd700' : index === 1 ? '#c0c0c0' : index === 2 ? '#cd7f32' : this.colors.textSecondary;
            ctx.font = "40pt OpenSans";
            ctx.textAlign = 'left';
            ctx.fillText(`#${index + 1}`, padding, y);

            // Username
            ctx.fillStyle = this.colors.text;
            ctx.font = "36pt OpenSans";
            ctx.fillText(stat.username, padding + 100, y);

            // Average Score
            ctx.textAlign = 'right';
            ctx.font = "40pt OpenSans";
            ctx.fillStyle = this.colors.text;
            ctx.fillText(stat.average.toFixed(2), width - padding - 300, y);

            ctx.font = "20pt OpenSans";
            ctx.fillStyle = this.colors.textSecondary;
            ctx.fillText('AVG', width - padding - 300, y + 25);

            // Today's Score Tile
            const tileX = width - padding - 150;
            const tileSize = 60;
            const tileY = y - 45;

            if (stat.todayScore) {
                const score = stat.todayScore.score;
                const color = score <= 3 ? this.colors.green : score <= 5 ? this.colors.yellow : this.colors.gray;

                ctx.fillStyle = color;
                ctx.fillRect(tileX, tileY, tileSize, tileSize);

                ctx.fillStyle = this.colors.text;
                ctx.font = "30pt OpenSans";
                ctx.textAlign = 'center';
                // ctx.textBaseline = 'middle'; // PureImage might not support textBaseline
                ctx.fillText(stat.todayScore.rawScore, tileX + tileSize / 2, tileY + tileSize / 2 + 10); // Manual adjustment
            } else {
                // Did not play today
                ctx.strokeStyle = this.colors.gray;
                // ctx.lineWidth = 2; // PureImage might not support lineWidth
                // ctx.strokeRect(tileX, tileY, tileSize, tileSize); // PureImage might not support strokeRect

                // Fallback: Fill with dark gray
                ctx.fillStyle = '#2a2a2b';
                ctx.fillRect(tileX, tileY, tileSize, tileSize);

                ctx.fillStyle = this.colors.gray;
                ctx.font = "20pt OpenSans";
                ctx.textAlign = 'center';
                ctx.fillText('-', tileX + tileSize / 2, tileY + tileSize / 2 + 10);
            }

            // History Dots (Last 5)
            const historyStartX = padding + 400;
            const dotSize = 20;
            const dotGap = 10;

            stat.recentHistory.forEach((h, i) => {
                const dotX = historyStartX + (i * (dotSize + dotGap));
                const dotY = y - 10;

                const color = h.score <= 3 ? this.colors.green : h.score <= 5 ? this.colors.yellow : this.colors.gray;

                ctx.fillStyle = color;
                ctx.beginPath();
                ctx.arc(dotX, dotY, dotSize / 2, 0, Math.PI * 2, 0);
                ctx.fill();
            });

            // Label for History
            if (index === 0) {
                ctx.fillStyle = this.colors.textSecondary;
                ctx.font = "14pt OpenSans";
                ctx.textAlign = 'left';
                ctx.fillText('LAST 5', historyStartX, y - 40);
            }
        });
    }

    // Helper to draw rounded rectangles (PureImage does not have this directly, using fillRect as fallback for row background)
    roundRect(ctx, x, y, width, height, radius) {
        // PureImage does not support roundRect directly, and the instruction implies replacing it.
        // For the row background, we're using fillRect. For other elements, we'll simplify or omit.
        ctx.fillRect(x, y, width, height);
    }

    // Helper to darken/lighten hex color
    adjustColor(color, amount) {
        return '#' + color.replace(/^#/, '').replace(/../g, color => ('0' + Math.min(255, Math.max(0, parseInt(color, 16) + amount)).toString(16)).substr(-2));
    }

    encodeVideo(framesDir, outputPath, fps) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y',
                '-framerate', fps.toString(),
                '-i', path.join(framesDir, 'frame%05d.png'),
                '-c:v', 'libx264',
                '-pix_fmt', 'yuv420p',
                '-preset', 'medium',
                '-crf', '23',
                outputPath
            ]);

            let stderr = '';

            ffmpeg.stderr.on('data', (data) => {
                stderr += data.toString();
            });

            ffmpeg.on('close', (code) => {
                if (code === 0) {
                    resolve();
                } else {
                    reject(new Error(`ffmpeg failed with code ${code}: ${stderr}`));
                }
            });

            ffmpeg.on('error', (err) => {
                reject(new Error(`Failed to start ffmpeg: ${err.message}`));
            });
        });
    }
}


