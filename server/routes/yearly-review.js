import express from 'express';
import { config } from '../../shared/config.js';

const router = express.Router();

function isEnabled() {
    return config.yearlyReview.enabled;
}

function year() {
    return config.yearlyReview.year;
}

export default function (db) {
    // List all users who played in the review year
    router.get('/users', async (req, res) => {
        if (!isEnabled()) {
            return res.status(403).json({ error: `${year()} review is disabled` });
        }
        try {
            const users = await db.getYearlyStats(year());
            res.json(users);
        } catch (error) {
            console.error(`[YearlyReview] Error fetching users:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Stats for a specific user in the review year
    router.get('/stats/:username', async (req, res) => {
        if (!isEnabled()) {
            return res.status(403).json({ error: `${year()} review is disabled` });
        }
        try {
            const stats = await db.getYearlyStats(year(), req.params.username);
            if (!stats) {
                return res.status(404).json({ error: `User not found or no data for ${year()}` });
            }
            res.json(stats);
        } catch (error) {
            console.error(`[YearlyReview] Error fetching stats:`, error);
            res.status(500).json({ error: 'Internal server error' });
        }
    });

    // Current review year — lets the frontend know which year is active
    router.get('/year', (req, res) => {
        res.json({ year: year(), enabled: isEnabled() });
    });

    // Generate AI comment for a user
    router.post('/ai-comment', async (req, res) => {
        if (!isEnabled()) {
            return res.status(403).json({ error: `${year()} review is disabled` });
        }
        try {
            const { username } = req.body;
            if (!username) return res.status(400).json({ error: 'Username required' });

            const stats = await db.getYearlyStats(year(), username);
            if (!stats) return res.status(404).json({ error: 'Stats not found' });

            // Return cached comment if available
            const cachedComment = db.getYearComment(username, year(), stats.totalGames);
            if (cachedComment) {
                return res.json({ comment: cachedComment });
            }

            const apiKey = process.env.SILICONFLOW_API;
            if (!apiKey) {
                console.error('[YearlyReview] SILICONFLOW_API not set');
                return res.status(500).json({ error: 'API key configuration error' });
            }

            const scoreHistory = stats.rawGames ? stats.rawGames.map(g => g.score).join(' ') : 'No games';
            const prompt = `You are a witty, slightly strict and sarcastic Wordle judge.
Analyze these ${year()} stats for player "${stats.username}":
- Total Games: ${stats.totalGames}
- Win Rate (Day Winner): ${Math.round(stats.winningRate)}%
- Pass Rate (No X): ${Math.round(stats.passingRate)}%
- Longest Streak: ${stats.maxStreak}
- Best Month: ${stats.bestMonth ? stats.bestMonth.month : 'None'}
- Guess Distribution: ${JSON.stringify(stats.guessDistribution)}
- Full Score History: ${scoreHistory}

Give a short (max 40 words) commentary on their year. Be creative, use a typewriter style persona.
Start with a witty, slightly strict observation or roast, but end with a genuinely encouraging and nice remark about their ${year()} performance.
Output ONLY the text of the comment.`;

            const response = await fetch('https://api.siliconflow.cn/v1/chat/completions', {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${apiKey}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'zai-org/GLM-4.6',
                    messages: [{ role: 'user', content: prompt }],
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
                    response_format: { type: 'text' },
                }),
            });

            if (!response.ok) {
                const errText = await response.text();
                throw new Error(`SiliconFlow API error: ${errText}`);
            }

            const data = await response.json();
            const finalComment = (data.choices?.[0]?.message?.content || 'Speechless.').trim();

            db.saveYearComment(username, year(), stats.totalGames, finalComment);

            res.json({ comment: finalComment });

        } catch (error) {
            console.error('[YearlyReview] Error generating AI comment:', error);
            res.status(500).json({ error: 'Failed to generate comment' });
        }
    });

    return router;
}
