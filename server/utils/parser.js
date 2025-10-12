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
        const crown = match[1];
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
                        username: cleanUser,
                        score: score,
                        is_winner: crown ? true : false
                    });
                }
            }
        }
    }

    return {
        day: streakDay,
        results: results
    };
}

function scoreToNumeric(score) {
    return score === 'X' ? 7 : parseInt(score);
}

module.exports = {
    parseMessage,
    scoreToNumeric
};


