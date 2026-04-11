import express from 'express';
import path from 'path';

const router = express.Router();

export default function (db) {
    // Get list of users who played in 2025
    router.get('/users', async (req, res) => {
        if (process.env.visibility_2025 === 'false') {
            return res.status(403).json({ error: '2025 review is disabled' });
        }
        try {
            const users = await db.getYearlyStats(2025);
            res.json(users);
        } catch (error) {
            console.error('Error fetching 2025 users:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Get stats for a specific user in 2025
    router.get('/stats/:username', async (req, res) => {
        if (process.env.visibility_2025 === 'false') {
            return res.status(403).json({ error: '2025 review is disabled' });
        }
        try {
            const stats = await db.getYearlyStats(2025, req.params.username);
            if (!stats) {
                return res.status(404).json({ error: 'User not found or no data for 2025' });
            }
            res.json(stats);
        } catch (error) {
            console.error('Error fetching 2025 stats:', error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Generate AI Comment
    router.post('/ai-comment', async (req, res) => {
        if (process.env.visibility_2025 === 'false') {
            return res.status(403).json({ error: '2025 review is disabled' });
        }
        try {
            const { username } = req.body;
            if (!username) return res.status(400).json({ error: 'Username required' });

            const stats = await db.getYearlyStats(2025, username);
            if (!stats) return res.status(404).json({ error: 'Stats not found' });

            // Check Cache
            const cachedComment = db.getYearComment(username, 2025, stats.totalGames);
            if (cachedComment) {
                return res.json({ comment: cachedComment });
            }

            // Read API Key from environment
            const apiKey = process.env.SILICONFLOW_API;
            if (!apiKey) {
                console.error('SILICONFLOW_API not found in environment');
                return res.status(500).json({ error: 'API key configuration error' });
            }

            // Prepare prompt
            const scoreHistory = stats.rawGames ? stats.rawGames.map(g => g.score).join(' ') : 'No games';
            const prompt = `You are a witty, slightly strict and sarcastic Wordle judge.
Analyze these 2025 stats for player "${stats.username}":
- Total Games: ${stats.totalGames}
- Win Rate (Day Winner): ${Math.round(stats.winningRate)}%
- Pass Rate (No X): ${Math.round(stats.passingRate)}%
- Longest Streak: ${stats.maxStreak}
- Best Month: ${stats.bestMonth ? stats.bestMonth.month : 'None'}
- Guess Distribution: ${JSON.stringify(stats.guessDistribution)}
- Full Score History: ${scoreHistory}

Give a short (max 40 words) commentary on their year. Be creative, use a typewriter style persona. 
Start with a witty, slightly strict observation or roast, but end with a genuinely encouraging and nice remark about their 2025 performance.
Output ONLY the text of the comment.`;

            const options = {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model: 'zai-org/GLM-4.6',
                    messages: [
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    stream: false,
                    max_tokens: 4096,
                    enable_thinking: false,
                    thinking_budget: 4096,
                    min_p: 0.05,
                    stop: null,
                    temperature: 0.7,
                    top_p: 0.7,
                    top_k: 50,
                    frequency_penalty: 0.5,
                    n: 1,
                    response_format: { type: 'text' }
                })
            };

            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', options);

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`SiliconFlow API error: ${errText}`);
            }

            const data = await response.json();
            const aiText = data.choices?.[0]?.message?.content || "Speechless.";
            const finalComment = aiText.trim();

            // Save to Cache
            db.saveYearComment(username, 2025, stats.totalGames, finalComment);

            res.json({ comment: finalComment });

        } catch (error) {
            console.error('Error generating AI comment:', error);
            res.status(500).json({ error: 'Failed to generate comment' });
        }
    });

    return router;
};
