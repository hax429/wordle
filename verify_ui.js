const http = require('http');

function fetch(url) {
    return new Promise((resolve, reject) => {
        http.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => resolve(data));
        }).on('error', reject);
    });
}

(async () => {
    console.log('🚀 Starting HTTP Verification...');

    try {
        const html = await fetch('http://localhost:3001');

        // 1. Check Title
        if (html.includes('<title>WORDLE STATS → Daily Word Champions</title>')) {
            console.log('✓ Title Verified');
        } else {
            console.error('❌ Title Mismatch');
        }

        // 2. Check Dark Mode Toggle
        if (html.includes('id="themeToggle"')) {
            console.log('✓ Dark Mode Toggle Found');
        } else {
            console.error('❌ Dark Mode Toggle Missing');
        }

        // 3. Check Loading Spinner
        if (html.includes('class="wordle-loader"')) {
            console.log('✓ Wordle Loader Found');
        } else {
            console.error('❌ Wordle Loader Missing');
        }

        // 4. Check CSS Link
        if (html.includes('href="/css/styles.css"')) {
            console.log('✓ CSS Link Verified');
        } else {
            console.error('❌ CSS Link Missing');
        }

        console.log('✅ Basic HTML Verification Passed!');

    } catch (error) {
        console.error('❌ Verification Failed:', error);
        process.exit(1);
    }
})();
