// Temporary username aliases - maps alternate names to canonical usernames
const USERNAME_ALIASES = {
    'going to Brandeis': 'Nina58',
    'committed to Brandeis': 'Nina58',
    '2.718281828459045235360287471352': 'nemophila',
    'Gabito': 'Ostritch',
    'Tatebro': 'AlligatorAnnotates',
    'CrocAnnotates': 'AlligatorAnnotates',
    'got into uma!': 'anka',
    'got into uma': 'anka',
    'committing to uma!!!': 'anka',
    'ænedca': 'anka',
    'იხვუკა': 'anka',
    'იხvუკა': 'anka',
    'waiting for uma...': 'anka',
    'waiting for uma': 'anka',
    'bananas': 'cough drop',
    'the most benevolent dictator': 'Gabe',
    'denied by jhu...': 'Gabe',
    'got into ucla': 'Grass'
};

function normalizeUsername(username) {
    return USERNAME_ALIASES[username] || username;
}

function parseMessage(message) {
    // Extract streak day
    const streakMatch = message.match(/(\d+) day streak/);
    if (!streakMatch) {
        throw new Error("Could not find streak day in message");
    }

    const streakDay = parseInt(streakMatch[1]);
    const results = [];

    // Find all score lines with pattern: optional crown + score + usernames
    const scorePattern = /(👑\s*)?([1-6X])\/6:\s*([^👑]*?)(?=(?:[1-6X]\/6:|$))/g;
    let match;

    while ((match = scorePattern.exec(message)) !== null) {
        // match[1] is crown (ignored now, we calculate it ourselves)
        const score = match[2];
        const usernames = match[3];

        // Split by @ and process each potential username
        const parts = usernames.split('@').slice(1); // Skip first empty part

        for (const part of parts) {
            // Extract username until next @ or score pattern
            const usernameMatch = part.match(/([^@]*?)(?=@|\d\/6:|[A-Z]\/6:|$)/);
            if (usernameMatch) {
                let rawUsername = usernameMatch[1].trim();

                // Skip empty usernames
                if (!rawUsername) {
                    continue;
                }

                // Clean username - remove trailing punctuation
                const cleanUser = rawUsername.replace(/[,;.!?]+$/, '').trim();

                if (cleanUser && cleanUser.length > 0) {
                    results.push({
                        username: normalizeUsername(cleanUser),
                        score: score,
                        // temporary flag, winner logic applied after collecting all scores
                        is_winner: false
                    });
                }
            }
        }
    }

    // WINNER CALCULATION LOGIC
    // 1. Filter out 'X' scores (failed)
    const validScores = results.filter(r => r.score !== 'X').map(r => parseInt(r.score));

    // 2. Find minimum score if any valid scores exist
    let minScore = Infinity;
    if (validScores.length > 0) {
        minScore = Math.min(...validScores);
    }

    // 3. Mark winners
    results.forEach(result => {
        if (result.score === 'X') {
            result.is_winner = false;
        } else {
            const numericScore = parseInt(result.score);
            result.is_winner = (numericScore === minScore);
        }
    });

    return {
        day: streakDay,
        results: results
    };
}

function scoreToNumeric(score) {
    return score === 'X' ? 7 : parseInt(score);
}

export {
    parseMessage,
    scoreToNumeric
};


