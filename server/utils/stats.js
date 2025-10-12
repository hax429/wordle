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
        rankings.average_score = activeUsers
            .sort((a, b) => a[1].average_score - b[1].average_score);

        // Participation Ranking (higher is better)
        rankings.participation = activeUsers
            .sort((a, b) => (b[1].days_participated || 0) - (a[1].days_participated || 0));

        // Score Consistency Ranking (lower variance is better)
        rankings.score_consistency = activeUsers
            .sort((a, b) => a[1].score_variance - b[1].score_variance);

        // Streak Consistency Ranking (higher is better)
        const usersWithStreaks = activeUsers.filter(([_, data]) => data.consistency_score !== undefined);
        rankings.streak_consistency = usersWithStreaks
            .sort((a, b) => (b[1].consistency_score || 0) - (a[1].consistency_score || 0));

        // Longest Streak Ranking
        rankings.longest_streak = usersWithStreaks
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
}

module.exports = StatsCalculator;


