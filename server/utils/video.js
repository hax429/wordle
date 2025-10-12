const { createCanvas } = require('canvas');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

class VideoGenerator {
    constructor(db) {
        this.db = db;
        this.colors = [
            '#FF4444', '#00FF88', '#4488FF', '#FFBB00', '#FF8844',
            '#BB44FF', '#00FFFF', '#FF44BB', '#88FF44', '#FF6600',
            '#0088FF', '#FF0088', '#AAFF00', '#8800FF', '#00FF44',
            '#FF2200', '#0044FF', '#FFAA44', '#FF4400', '#44AAFF'
        ];
    }

    getUserDataOverTime() {
        const query = `
            SELECT s.day, u.username, r.score
            FROM results r
            JOIN users u ON r.user_id = u.id
            JOIN streaks s ON r.streak_day = s.day
            ORDER BY s.day, u.username
        `;

        const rows = this.db.db.prepare(query).all();
        const userData = {};
        const allDays = new Set();

        for (const row of rows) {
            if (!userData[row.username]) {
                userData[row.username] = [];
            }
            const numericScore = row.score === 'X' ? 7 : parseInt(row.score);
            userData[row.username].push({ day: row.day, score: numericScore });
            allDays.add(row.day);
        }

        const sortedDays = Array.from(allDays).sort((a, b) => a - b);
        
        // Convert to day-indexed format
        const dayData = {};
        for (const day of sortedDays) {
            dayData[day] = {};
            for (const [username, scores] of Object.entries(userData)) {
                const dayScore = scores.find(s => s.day === day);
                dayData[day][username] = dayScore ? dayScore.score : null;
            }
        }

        return {
            dayData,
            sortedDays,
            allUsers: Object.keys(userData)
        };
    }

    async generate2DVideo(outputPath, options = {}) {
        const fps = options.fps || 3;
        const windowSize = options.windowSize || 6;
        const width = 1920;
        const height = 1080;

        console.log('📊 Extracting data...');
        const data = this.getUserDataOverTime();
        
        if (data.sortedDays.length === 0) {
            throw new Error('No data available to generate video');
        }

        console.log(`🎬 Generating ${data.sortedDays.length} frames...`);
        
        // Create frames directory
        const framesDir = path.join(path.dirname(outputPath), 'frames_temp');
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }

        // Assign colors to users
        const userColors = {};
        data.allUsers.forEach((user, i) => {
            userColors[user] = this.colors[i % this.colors.length];
        });

        // Generate frames
        for (let frameIdx = 0; frameIdx < data.sortedDays.length; frameIdx++) {
            const currentDay = data.sortedDays[frameIdx];
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');

            // Background
            ctx.fillStyle = '#0f0f0f';
            ctx.fillRect(0, 0, width, height);

            // Calculate window
            let windowStart = Math.max(0, frameIdx - Math.floor(windowSize / 2));
            let windowEnd = Math.min(data.sortedDays.length - 1, windowStart + windowSize - 1);
            
            if (windowEnd - windowStart < windowSize - 1) {
                windowStart = Math.max(0, windowEnd - windowSize + 1);
            }

            const startDay = data.sortedDays[windowStart];
            const endDay = data.sortedDays[windowEnd];

            // Draw title
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 48px Arial';
            ctx.textAlign = 'center';
            const progress = ((frameIdx + 1) / data.sortedDays.length * 100).toFixed(0);
            ctx.fillText(`Wordle Progress - Day ${currentDay} (${progress}%)`, width / 2, 80);

            // Chart area
            const chartLeft = 150;
            const chartRight = width - 300;
            const chartTop = 150;
            const chartBottom = height - 150;
            const chartWidth = chartRight - chartLeft;
            const chartHeight = chartBottom - chartTop;

            // Draw grid and axes
            ctx.strokeStyle = '#475569';
            ctx.lineWidth = 2;
            
            // Y-axis lines and labels
            for (let score = 1; score <= 7; score++) {
                const y = chartBottom - ((8 - score) / 7) * chartHeight;
                
                ctx.strokeStyle = '#475569';
                ctx.beginPath();
                ctx.moveTo(chartLeft, y);
                ctx.lineTo(chartRight, y);
                ctx.stroke();

                ctx.fillStyle = '#cbd5e1';
                ctx.font = '20px Arial';
                ctx.textAlign = 'right';
                const label = score === 7 ? 'X' : score.toString();
                ctx.fillText(label, chartLeft - 20, y + 7);
            }

            // Y-axis label
            ctx.save();
            ctx.translate(50, height / 2);
            ctx.rotate(-Math.PI / 2);
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Score (Lower = Better)', 0, 0);
            ctx.restore();

            // X-axis label
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 24px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('Day', width / 2, height - 50);

            // Draw data for each user
            const visibleDays = data.sortedDays.slice(windowStart, Math.min(frameIdx + 1, windowEnd + 1));
            
            for (const user of data.allUsers) {
                const color = userColors[user];
                const userPoints = [];

                for (const day of visibleDays) {
                    const score = data.dayData[day][user];
                    if (score !== null) {
                        const x = chartLeft + ((day - startDay) / (endDay - startDay)) * chartWidth;
                        const y = chartBottom - ((8 - score) / 7) * chartHeight;
                        userPoints.push({ x, y });
                    }
                }

                if (userPoints.length > 0) {
                    // Draw line
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 4;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    
                    ctx.beginPath();
                    ctx.moveTo(userPoints[0].x, userPoints[0].y);
                    for (let i = 1; i < userPoints.length; i++) {
                        ctx.lineTo(userPoints[i].x, userPoints[i].y);
                    }
                    ctx.stroke();

                    // Draw points
                    for (const point of userPoints) {
                        // White border
                        ctx.fillStyle = 'white';
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 8, 0, Math.PI * 2);
                        ctx.fill();

                        // Colored center
                        ctx.fillStyle = color;
                        ctx.beginPath();
                        ctx.arc(point.x, point.y, 6, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }

            // Draw legend
            const legendX = chartRight + 40;
            let legendY = chartTop;
            
            ctx.fillStyle = '#f1f5f9';
            ctx.font = 'bold 20px Arial';
            ctx.textAlign = 'left';
            ctx.fillText('Players:', legendX, legendY);
            
            legendY += 40;
            
            for (const user of data.allUsers) {
                const color = userColors[user];
                
                // Color box
                ctx.fillStyle = color;
                ctx.fillRect(legendX, legendY - 15, 30, 20);
                
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 2;
                ctx.strokeRect(legendX, legendY - 15, 30, 20);

                // Username
                ctx.fillStyle = '#f1f5f9';
                ctx.font = '18px Arial';
                ctx.fillText(user, legendX + 40, legendY);
                
                legendY += 30;
            }

            // Save frame
            const framePath = path.join(framesDir, `frame${frameIdx.toString().padStart(5, '0')}.png`);
            const buffer = canvas.toBuffer('image/png');
            fs.writeFileSync(framePath, buffer);

            if ((frameIdx + 1) % 10 === 0) {
                console.log(`  Generated ${frameIdx + 1}/${data.sortedDays.length} frames`);
            }
        }

        console.log('🎞️  Encoding video with ffmpeg...');

        // Use ffmpeg to create video
        await this.encodeVideo(framesDir, outputPath, fps);

        // Clean up frames
        console.log('🧹 Cleaning up temporary files...');
        fs.rmSync(framesDir, { recursive: true, force: true });

        console.log(`✅ Video generated: ${outputPath}`);
        return outputPath;
    }

    encodeVideo(framesDir, outputPath, fps) {
        return new Promise((resolve, reject) => {
            const ffmpeg = spawn('ffmpeg', [
                '-y', // Overwrite output file
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
                reject(new Error(`Failed to start ffmpeg: ${err.message}. Make sure ffmpeg is installed.`));
            });
        });
    }

    async generateVideo(type, outputPath, options = {}) {
        if (type === '2d' || type === '3d') {
            return await this.generate2DVideo(outputPath, options);
        } else {
            throw new Error(`Unknown video type: ${type}`);
        }
    }
}

module.exports = VideoGenerator;


