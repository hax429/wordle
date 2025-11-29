const { scoreToNumeric } = require('./parser');

class StatsCalculator {
    constructor(db) {
        this.db = db;
    }

    getAllTimeStats() {
        // Get user stats with scores
        const query = `
            SELECT u.username, u.id,
                   COUNT(r.id) as games_played,
                   GROUP_CONCAT(r.score) as all_scores
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id, u.username
            HAVING games_played > 0
            ORDER BY u.username
        `;

        const userRows = this.db.db.prepare(query).all();
        const userData = {};

        for (const row of userRows) {
            const scores = row.all_scores ? row.all_scores.split(',') : [];
            const numericScores = scores.map(s => scoreToNumeric(s));

            const average = numericScores.length > 0
                ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
                : 0;

            const variance = numericScores.length > 1
                ? this.calculateVariance(numericScores)
                : 0;

            userData[row.username] = {
                user_id: row.id,
                games_played: row.games_played,
                scores: scores,
                numeric_scores: numericScores,
                average_score: average,
                score_variance: variance
            };
        }

        // Get participation data
        const participationQuery = `
            SELECT u.username,
                   COUNT(DISTINCT r.streak_day) as days_participated,
                   (SELECT COUNT(*) FROM streaks) as total_days
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id, u.username
            HAVING days_participated > 0
        `;

        const participationRows = this.db.db.prepare(participationQuery).all();
        for (const row of participationRows) {
            if (userData[row.username]) {
                userData[row.username].days_participated = row.days_participated;
                userData[row.username].participation_rate = row.total_days > 0
                    ? row.days_participated / row.total_days
                    : 0;
            }
        }

        // Get streak data
        const streakData = this.calculateStreakConsistency();
        for (const [username, streakInfo] of Object.entries(streakData)) {
            if (userData[username]) {
                Object.assign(userData[username], streakInfo);
            }
        }

        return userData;
    }

    getLastWeekStats() {
        // Get max day
        const maxDayRow = this.db.db.prepare('SELECT MAX(day) as max_day FROM streaks').get();
        if (!maxDayRow || !maxDayRow.max_day) {
            return {};
        }

        const maxDay = maxDayRow.max_day;
        const startDay = Math.max(1, maxDay - 6);

        const query = `
            SELECT u.username, u.id,
                   COUNT(r.id) as games_played,
                   GROUP_CONCAT(r.score) as all_scores
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            WHERE r.streak_day >= ? AND r.streak_day <= ?
            GROUP BY u.id, u.username
            HAVING games_played > 0
            ORDER BY u.username
        `;

        const userRows = this.db.db.prepare(query).all(startDay, maxDay);
        const userData = {};

        for (const row of userRows) {
            const scores = row.all_scores ? row.all_scores.split(',') : [];
            const numericScores = scores.map(s => scoreToNumeric(s));

            const average = numericScores.length > 0
                ? numericScores.reduce((a, b) => a + b, 0) / numericScores.length
                : 0;

            const variance = numericScores.length > 1
                ? this.calculateVariance(numericScores)
                : 0;

            userData[row.username] = {
                user_id: row.id,
                games_played: row.games_played,
                scores: scores,
                numeric_scores: numericScores,
                average_score: average,
                score_variance: variance,
                days_participated: row.games_played,
                participation_rate: row.games_played / 7.0
            };
        }

        // Get streak data for last week
        const streakData = this.calculateStreakConsistency(startDay, maxDay);
        for (const [username, streakInfo] of Object.entries(streakData)) {
            if (userData[username]) {
                Object.assign(userData[username], streakInfo);
            }
        }

        return userData;
    }

    calculateStreakConsistency(startDay = null, endDay = null) {
        let query = `
            SELECT u.username,
                   GROUP_CONCAT(r.streak_day ORDER BY r.streak_day) as days
            FROM users u
            JOIN results r ON u.id = r.user_id
        `;

        const params = [];
        if (startDay && endDay) {
            query += ' WHERE r.streak_day >= ? AND r.streak_day <= ?';
            params.push(startDay, endDay);
        }

        query += ' GROUP BY u.id, u.username';

        const rows = this.db.db.prepare(query).all(...params);
        const streakData = {};

        for (const row of rows) {
            if (!row.days) continue;

            const days = row.days.split(',').map(d => parseInt(d));
            const longestStreak = this.findLongestConsecutiveStreak(days);

            const gaps = [];
            for (let i = 1; i < days.length; i++) {
                const gap = days[i] - days[i - 1];
                if (gap > 1) {
                    gaps.push(gap - 1);
                }
            }

            const avgGap = gaps.length > 0
                ? gaps.reduce((a, b) => a + b, 0) / gaps.length
                : 0;

            const consistencyScore = 1 / (1 + avgGap);

            streakData[row.username] = {
                longest_streak: longestStreak,
                consistency_score: consistencyScore,
                total_gaps: gaps.length,
                average_gap: avgGap
            };
        }

        return streakData;
    }

    findLongestConsecutiveStreak(days) {
        if (days.length === 0) return 0;

        let maxStreak = 1;
        let currentStreak = 1;

        for (let i = 1; i < days.length; i++) {
            if (days[i] === days[i - 1] + 1) {
                currentStreak++;
                maxStreak = Math.max(maxStreak, currentStreak);
            } else {
                currentStreak = 1;
            }
        }

        return maxStreak;
    }

    getRankings(statsData) {
        if (!statsData || Object.keys(statsData).length === 0) {
            return {};
        }

        // Filter users with sufficient data
        const activeUsers = Object.entries(statsData).filter(([_, data]) => data.games_played >= 3);

        const rankings = {};

        // Average Score Ranking (lower is better)
        rankings.average_score = [...activeUsers]
            .sort((a, b) => a[1].average_score - b[1].average_score);

        // Participation Ranking (higher is better)
        rankings.participation = [...activeUsers]
            .sort((a, b) => (b[1].days_participated || 0) - (a[1].days_participated || 0));

        // Score Consistency Ranking (lower variance is better)
        rankings.score_consistency = [...activeUsers]
            .sort((a, b) => a[1].score_variance - b[1].score_variance);

        // Streak Consistency Ranking (higher is better)
        const usersWithStreaks = activeUsers.filter(([_, data]) => data.consistency_score !== undefined);
        rankings.streak_consistency = [...usersWithStreaks]
            .sort((a, b) => (b[1].consistency_score || 0) - (a[1].consistency_score || 0));

        // Longest Streak Ranking
        rankings.longest_streak = [...usersWithStreaks]
            .sort((a, b) => (b[1].longest_streak || 0) - (a[1].longest_streak || 0));

        return rankings;
    }

    getPlotData() {
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
            userData[row.username].push({
                day: row.day,
                score: scoreToNumeric(row.score)
            });
            allDays.add(row.day);
        }

        const sortedDays = Array.from(allDays).sort((a, b) => a - b);

        const colors = [
            '#FF4444', '#00FF88', '#4488FF', '#FFBB00', '#FF8844',
            '#BB44FF', '#00FFFF', '#FF44BB', '#88FF44', '#FF6600',
            '#0088FF', '#FF0088', '#AAFF00', '#8800FF', '#00FF44',
            '#FF2200', '#0044FF', '#FFAA44', '#FF4400', '#44AAFF'
        ];

        const plotData = {
            days: sortedDays,
            users: []
        };

        Object.entries(userData).forEach(([username, scores], index) => {
            const scoreMap = {};
            scores.forEach(s => {
                scoreMap[s.day] = s.score;
            });

            const userPlotData = {
                name: username,
                color: colors[index % colors.length],
                data: []
            };

            for (const day of sortedDays) {
                if (scoreMap[day] !== undefined) {
                    userPlotData.data.push({ x: day, y: scoreMap[day] });
                } else {
                    userPlotData.data.push({ x: day, y: null });
                }
            }

            plotData.users.push(userPlotData);
        });

        return plotData;
    }

    calculateVariance(numbers) {
        const mean = numbers.reduce((a, b) => a + b, 0) / numbers.length;
        const squaredDiffs = numbers.map(n => Math.pow(n - mean, 2));
        return squaredDiffs.reduce((a, b) => a + b, 0) / (numbers.length - 1);
    }

    getInterestingFacts(startDay = null, endDay = null) {
        const facts = {
            allTime: [],
            last7Days: []
        };

        // Query to get all scores in the period
        let scoresQuery = `
            SELECT u.username, r.score, r.streak_day
            FROM results r
            JOIN users u ON r.user_id = u.id
        `;

        const params = [];
        if (startDay && endDay) {
            scoresQuery += ' WHERE r.streak_day >= ? AND r.streak_day <= ?';
            params.push(startDay, endDay);
        }
        scoresQuery += ' ORDER BY r.streak_day';

        const allResults = this.db.db.prepare(scoresQuery).all(...params);

        // 1. Find who has the 1-guess win (score of "1")
        const oneGuessWins = allResults.filter(r => r.score === '1');
        if (oneGuessWins.length > 0) {
            facts.allTime.push({
                type: 'oneGuessChampion',
                title: 'Impossible Achievement',
                username: oneGuessWins[0].username,
                detail: 'Got it in just 1 guess!',
                badge: '1️⃣',
                color: 'gold',
                highlight: true
            });
        }

        // 2. Find the rising star (best improvement in last week vs previous period)
        if (!startDay && !endDay) {
            // Only calculate for all-time view
            const maxDayRow = this.db.db.prepare('SELECT MAX(day) as max_day FROM streaks').get();
            if (maxDayRow && maxDayRow.max_day && maxDayRow.max_day >= 14) {
                const recentStart = maxDayRow.max_day - 6;
                const previousStart = maxDayRow.max_day - 13;
                const previousEnd = maxDayRow.max_day - 7;

                const userImprovements = [];

                // Get all users who played in both periods
                const usersQuery = `
                    SELECT DISTINCT u.id, u.username
                    FROM users u
                    JOIN results r1 ON u.id = r1.user_id AND r1.streak_day >= ? AND r1.streak_day <= ?
                    JOIN results r2 ON u.id = r2.user_id AND r2.streak_day >= ? AND r2.streak_day <= ?
                `;

                const users = this.db.db.prepare(usersQuery).all(previousStart, previousEnd, recentStart, maxDayRow.max_day);

                for (const user of users) {
                    const previousScores = this.db.db.prepare(`
                        SELECT score FROM results
                        WHERE user_id = ? AND streak_day >= ? AND streak_day <= ?
                    `).all(user.id, previousStart, previousEnd);

                    const recentScores = this.db.db.prepare(`
                        SELECT score FROM results
                        WHERE user_id = ? AND streak_day >= ? AND streak_day <= ?
                    `).all(user.id, recentStart, maxDayRow.max_day);

                    if (previousScores.length >= 2 && recentScores.length >= 2) {
                        const prevNumeric = previousScores.map(s => scoreToNumeric(s.score));
                        const recentNumeric = recentScores.map(s => scoreToNumeric(s.score));

                        const prevAvg = prevNumeric.reduce((a, b) => a + b, 0) / prevNumeric.length;
                        const recentAvg = recentNumeric.reduce((a, b) => a + b, 0) / recentNumeric.length;

                        const improvement = prevAvg - recentAvg; // Positive = better (lower scores)

                        if (improvement > 0) {
                            userImprovements.push({
                                username: user.username,
                                improvement: improvement,
                                previousAvg: prevAvg,
                                recentAvg: recentAvg
                            });
                        }
                    }
                }

                if (userImprovements.length > 0) {
                    userImprovements.sort((a, b) => b.improvement - a.improvement);
                    const best = userImprovements[0];
                    facts.last7Days.push({
                        type: 'risingStar',
                        title: 'Rising Star',
                        username: best.username,
                        detail: `Improved by ${best.improvement.toFixed(2)} points this week`,
                        badge: '⭐',
                        color: 'blue'
                    });
                }
            }
        }

        // 3. Find the consistency king (lowest variance)
        const statsData = startDay && endDay ? this.getLastWeekStats() : this.getAllTimeStats();
        const usersWithVariance = Object.entries(statsData)
            .filter(([_, data]) => data.games_played >= 5)
            .sort((a, b) => a[1].score_variance - b[1].score_variance);

        if (usersWithVariance.length > 0) {
            const [username, data] = usersWithVariance[0];
            facts.allTime.push({
                type: 'consistencyKing',
                title: 'Consistency King',
                username: username,
                detail: `Most consistent scores (avg: ${data.average_score.toFixed(2)})`,
                badge: '👑',
                color: 'purple'
            });
        }

        // 4. Find the comeback story (most X/6 saves after being close to failing)
        const closeCallScores = allResults.filter(r => r.score === '6' || r.score === '5');
        const userCloseCalls = {};

        closeCallScores.forEach(result => {
            if (!userCloseCalls[result.username]) {
                userCloseCalls[result.username] = { fives: 0, sixes: 0, total: 0 };
            }
            if (result.score === '5') userCloseCalls[result.username].fives++;
            if (result.score === '6') userCloseCalls[result.username].sixes++;
            userCloseCalls[result.username].total++;
        });

        const bestComeback = Object.entries(userCloseCalls)
            .sort((a, b) => b[1].total - a[1].total)
            .find(([_, data]) => data.total >= 3);

        if (bestComeback) {
            facts.allTime.push({
                type: 'comebackKing',
                title: 'Comeback King',
                username: bestComeback[0],
                detail: `${bestComeback[1].total} close calls (5s & 6s)`,
                badge: '💪',
                color: 'orange'
            });
        }

        // 5. Find perfect scorer (most scores of 2 or 3)
        const perfectScores = allResults.filter(r => r.score === '2' || r.score === '3');
        const userPerfectScores = {};

        perfectScores.forEach(result => {
            if (!userPerfectScores[result.username]) {
                userPerfectScores[result.username] = 0;
            }
            userPerfectScores[result.username]++;
        });

        const topPerfect = Object.entries(userPerfectScores)
            .sort((a, b) => b[1] - a[1])
            .find(([_, count]) => count >= 3);

        if (topPerfect) {
            facts.allTime.push({
                type: 'perfectScorer',
                title: 'Perfect Scorer',
                username: topPerfect[0],
                detail: `${topPerfect[1]} scores of 2 or 3`,
                badge: '💎',
                color: 'cyan'
            });
        }

        // 6. Weekend Warrior (Best average on Sat/Sun)
        // Assuming Day 0 = June 19, 2021 (Saturday)
        // So Day % 7 == 0 (Sat) or 1 (Sun)
        const weekendScores = allResults.filter(r => {
            const mod = r.streak_day % 7;
            return mod === 0 || mod === 1;
        });

        const userWeekendStats = {};
        weekendScores.forEach(r => {
            if (!userWeekendStats[r.username]) {
                userWeekendStats[r.username] = { sum: 0, count: 0 };
            }
            userWeekendStats[r.username].sum += scoreToNumeric(r.score);
            userWeekendStats[r.username].count++;
        });

        const bestWeekend = Object.entries(userWeekendStats)
            .filter(([_, data]) => data.count >= 5) // Min 5 weekend games
            .map(([username, data]) => ({ username, avg: data.sum / data.count }))
            .sort((a, b) => a.avg - b.avg)[0];

        if (bestWeekend) {
            facts.allTime.push({
                type: 'weekendWarrior',
                title: 'Weekend Warrior',
                username: bestWeekend.username,
                detail: `Best weekend avg: ${bestWeekend.avg.toFixed(2)}`,
                badge: '🏖️',
                color: 'green'
            });
        }

        // 7. Century Club (100+ games)
        const gamesPlayed = {};
        allResults.forEach(r => {
            gamesPlayed[r.username] = (gamesPlayed[r.username] || 0) + 1;
        });

        const centuryMember = Object.entries(gamesPlayed)
            .filter(([_, count]) => count >= 100)
            .sort((a, b) => b[1] - a[1])[0]; // Get the one with most games if multiple

        if (centuryMember) {
            facts.allTime.push({
                type: 'centuryClub',
                title: 'Century Club',
                username: centuryMember[0],
                detail: `${centuryMember[1]} games played`,
                badge: '💯',
                color: 'gold'
            });
        }

        // 8. Streak Master (Current active streak)
        // We need to check the most recent days. 
        // This is a bit complex without a "current date" context, but we can look at the latest streaks.
        // For now, let's rely on the streak data we already calculated in calculateStreakConsistency
        // But that calculates "longest streak ever". 
        // Let's just use the "Longest Streak" from the stats as a proxy for "Streak Master" if it's impressive (> 10)

        const streakStats = this.calculateStreakConsistency();
        const bestStreak = Object.entries(streakStats)
            .sort((a, b) => b[1].longest_streak - a[1].longest_streak)[0];

        if (bestStreak && bestStreak[1].longest_streak >= 5) {
            facts.last7Days.push({
                type: 'streakMaster',
                title: 'Streak Master',
                username: bestStreak[0],
                detail: `${bestStreak[1].longest_streak} day streak!`,
                badge: '🔥',
                color: 'red'
            });
        }

        return facts;
    }
}

module.exports = StatsCalculator;


