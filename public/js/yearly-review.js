const API_BASE = '/api/yearly-review';
let currentUsername = '';
let REVIEW_YEAR = '';

document.addEventListener('DOMContentLoaded', async () => {
    // Fetch the active review year first, then boot everything else
    try {
        const res = await fetch(`${API_BASE}/year`);
        const data = await res.json();
        REVIEW_YEAR = String(data.year);
    } catch (e) {
        REVIEW_YEAR = String(new Date().getFullYear());
    }

    // Inject year into all placeholder elements
    document.querySelectorAll('.review-year').forEach(el => {
        el.textContent = REVIEW_YEAR;
    });
    document.title = `Wordle ${REVIEW_YEAR} Replay`;

    fetchUsers();
    setupScrollObserver();
    initBackgroundAnimation();
});

async function fetchUsers() {
    try {
        const response = await fetch(`${API_BASE}/users`);
        const users = await response.json();
        const grid = document.getElementById('user-grid');
        grid.innerHTML = '';

        if (users.length === 0) {
            grid.innerHTML = `<div class="user-card">No data for ${REVIEW_YEAR} yet</div>`;
            return;
        }

        users.forEach(username => {
            const card = document.createElement('div');
            card.className = 'user-card';
            card.innerHTML = `<h3>${username}</h3>`;
            card.onclick = () => loadUserStats(username);
            grid.appendChild(card);
        });

        // Pre-warm AI comments
        prewarmComments(users);

    } catch (error) {
        console.error('Error fetching users:', error);
        document.getElementById('user-grid').innerHTML = '<div style="color:#aaa">Error loading players</div>';
    }
}

async function loadUserStats(username) {
    try {
        currentUsername = username; // Set global
        const response = await fetch(`${API_BASE}/stats/${username}`);
        if (!response.ok) throw new Error('Failed to load stats');

        const stats = await response.json();
        populateSlides(stats);

        // Transition UI: Hide user grid, show slides
        const userSlide = document.getElementById('slide-users');
        const slidesContainer = document.getElementById('slides-container');
        const scrollHint = document.getElementById('scroll-hint');

        // We want to smoothly transition
        userSlide.style.opacity = '0';
        setTimeout(() => {
            userSlide.style.display = 'none';
            slidesContainer.style.display = 'block';
            scrollHint.style.display = 'block';

            // Re-run observer for new slides
            setupScrollObserver();

            // Scroll to top just in case
            document.getElementById('app').scrollTop = 0;
        }, 500);

        // Confetti effect
        confetti({
            particleCount: 150,
            spread: 100,
            origin: { y: 0.6 },
            colors: ['#6aaa64', '#c9b458', '#ffffff']
        });

        // Generate poster when fonts are ready
        document.fonts.ready.then(() => {
            setTimeout(() => generatePoster(stats), 1000);
        });

        // Fetch AI Comment
        fetchAIComment(username);

    } catch (error) {
        alert('Error loading stats: ' + error.message);
    }
}

function populateSlides(stats) {
    document.getElementById('display-username').textContent = stats.username;

    // We store raw values in data-attributes for animation
    const passRateEl = document.getElementById('stat-pass-rate');
    passRateEl.textContent = '0%';
    passRateEl.dataset.value = Math.round(stats.passingRate);
    passRateEl.dataset.suffix = '%';

    const winRateEl = document.getElementById('stat-win-rate');
    winRateEl.textContent = '0%';
    winRateEl.dataset.value = Math.round(stats.winningRate);
    winRateEl.dataset.suffix = '%';

    const totalGamesEl = document.getElementById('stat-total-games');
    totalGamesEl.textContent = '0';
    totalGamesEl.dataset.value = stats.totalGames;

    // Consistency
    const months = {
        '01': 'January', '02': 'February', '03': 'March', '04': 'April',
        '05': 'May', '06': 'June', '07': 'July', '08': 'August',
        '09': 'September', '10': 'October', '11': 'November', '12': 'December'
    };

    if (stats.consistentMonth) {
        document.getElementById('stat-consistent-month').textContent = months[stats.consistentMonth.month] || stats.consistentMonth.month;
        document.getElementById('stat-consistent-games').textContent = stats.consistentMonth.games;
    }

    // Best Month
    if (stats.bestMonth) {
        document.getElementById('stat-best-month-avg').textContent = stats.bestMonth.avgGuesses;
        document.getElementById('stat-best-month').textContent = months[stats.bestMonth.month] || stats.bestMonth.month;
    }

    // Longest Streak
    const streakEl = document.getElementById('stat-max-streak');
    streakEl.textContent = '0';
    streakEl.dataset.value = stats.maxStreak;

    // Guess Distribution
    const distContainer = document.getElementById('guess-distribution');
    distContainer.innerHTML = '';

    const maxVal = Math.max(...Object.values(stats.guessDistribution));

    ['1', '2', '3', '4', '5', '6', 'X'].forEach(key => {
        const count = stats.guessDistribution[key] || 0;
        const width = maxVal > 0 ? (count / maxVal) * 100 : 0;
        const isWinner = key !== 'X';

        const row = document.createElement('div');
        row.className = 'graph-row';
        row.innerHTML = `
            <div class="graph-label">${key}</div>
            <div class="graph-bar-container">
                <div class="graph-bar ${isWinner ? 'winner' : ''}" style="width: 0%" data-width="${width}%">
                    ${count > 0 ? count : ''}
                </div>
            </div>
        `;
        distContainer.appendChild(row);
    });
}

// Local cache for promises
const aiCommentCache = new Map();

function prewarmComments(users) {
    // Process in small batches to avoid network congestion
    const batchSize = 3;
    let index = 0;

    function processNext() {
        if (index >= users.length) return;

        const batch = users.slice(index, index + batchSize);
        index += batchSize;

        batch.forEach(username => {
            if (!aiCommentCache.has(username)) {
                // Fire and store promise
                const p = fetch(`${API_BASE}/ai-comment`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ username })
                }).then(res => {
                    if (!res.ok) throw new Error(res.statusText);
                    return res.json();
                }).catch(err => {
                    console.warn(`Pre-warm failed for ${username}:`, err);
                    return { comment: null }; // Return null so we retry later if needed
                });
                aiCommentCache.set(username, p);
            }
        });

        setTimeout(processNext, 1000); // 1s delay between batches
    }

    processNext();
}


async function fetchAIComment(username) {
    const container = document.getElementById('ai-comment-text');
    const posterSlide = document.querySelector('.slide:last-child'); // Assuming poster is last

    // Hide poster initially
    if (posterSlide) posterSlide.style.display = 'none';

    // Random "loading" messages
    const loadingMsgs = [
        "Analyzing guess patterns...",
        "Judging your life choices...",
        "Calculating wit...",
        `Accessing ${REVIEW_YEAR} archives...`
    ];
    container.textContent = loadingMsgs[Math.floor(Math.random() * loadingMsgs.length)];
    container.dataset.fullText = "";

    container.dataset.fullText = "";

    try {
        let data;

        // Check local cache first
        if (aiCommentCache.has(username)) {
            const result = await aiCommentCache.get(username);
            if (result && result.comment) {
                data = result;
            }
        }

        // If not customized or failed, fetch now
        if (!data) {
            const res = await fetch(`${API_BASE}/ai-comment`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username })
            });

            if (!res.ok) {
                const errText = await res.text();
                console.error('AI API Error Log:', errText); // Print exact error
                throw new Error(`AI API Error: ${res.statusText}`);
            }
            data = await res.json();
        }

        container.dataset.fullText = data.comment;

        // If already active, type and then show poster
        const slide = container.closest('.slide');
        if (slide.classList.contains('active')) {
            typeWriterEffect(container, data.comment, 40, () => {
                if (posterSlide) {
                    posterSlide.style.display = 'flex';
                    // Optional: Scroll hint or wiggle
                    const hint = document.getElementById('scroll-hint');
                    if (hint) hint.style.display = 'block';
                }
            });
        }

    } catch (e) {
        console.error('Fetch error:', e);
        const failText = "AI module offline. You got lucky.";
        container.dataset.fullText = failText;
        const slide = container.closest('.slide');
        if (slide.classList.contains('active')) {
            typeWriterEffect(container, failText, 40, () => {
                if (posterSlide) posterSlide.style.display = 'flex';
            });
        }
    }
}

function typeWriterEffect(element, text, speed = 40, onComplete = null) {
    if (!text) return;
    // Reset if called again
    element.dataset.typing = 'true';
    element.textContent = '';

    let i = 0;

    function type() {
        if (i < text.length) {
            element.textContent += text.charAt(i);
            i++;
            // Vary speed
            const randomSpeed = speed + (Math.random() * 20 - 10);
            setTimeout(type, randomSpeed);
        } else {
            // Done
            if (onComplete) onComplete();
        }
    }
    type();
}

function animateValue(obj, start, end, duration, suffix = '') {
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        obj.innerHTML = Math.floor(progress * (end - start) + start) + suffix;
        if (progress < 1) {
            window.requestAnimationFrame(step);
        } else {
            obj.innerHTML = end + suffix;
        }
    };
    window.requestAnimationFrame(step);
}

function setupScrollObserver() {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('active');

                // Animate Numbers
                const animatedNumbers = entry.target.querySelectorAll('[data-value]');
                animatedNumbers.forEach(el => {
                    // Only animate if not already done
                    if (!el.dataset.animated) {
                        const val = parseInt(el.dataset.value);
                        const suffix = el.dataset.suffix || '';
                        animateValue(el, 0, val, 1500, suffix);
                        el.dataset.animated = 'true';
                    }
                });

                // Animate Bars
                const bars = entry.target.querySelectorAll('.graph-bar');
                bars.forEach(bar => {
                    setTimeout(() => {
                        bar.style.width = bar.getAttribute('data-width');
                    }, 500);
                });

                // Trigger Typewriter if present and ready
                const typewriter = entry.target.querySelector('#ai-comment-text');
                if (typewriter && typewriter.dataset.fullText && !typewriter.dataset.typing) {
                    const posterSlide = document.querySelector('.slide:last-child');
                    typeWriterEffect(typewriter, typewriter.dataset.fullText, 40, () => {
                        if (posterSlide) {
                            posterSlide.style.display = 'flex';
                            // Re-scroll hint
                            const hint = document.getElementById('scroll-hint');
                            if (hint) hint.style.display = 'block';
                        }
                    });
                }
            } else {
                // Optional: Reset animations when scrolling away? 
                // Better to keep them active so user doesn't miss them if scrolling back up quickly.
                // entry.target.classList.remove('active'); 
            }
        });
    }, { threshold: 0.4 });

    const slides = document.querySelectorAll('.slide');
    slides.forEach(slide => observer.observe(slide));
}

function generatePoster(stats) {
    const canvas = document.getElementById('poster-canvas');
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#121213';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative Elements (Subtle circles)
    ctx.fillStyle = '#1a1a1b';
    ctx.beginPath();
    ctx.arc(100, 100, 300, 0, 2 * Math.PI);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(canvas.width - 50, canvas.height - 50, 400, 0, 2 * Math.PI);
    ctx.fill();

    // Wordle Pattern Background
    ctx.globalAlpha = 0.05;
    for (let i = 0; i < 40; i++) {
        for (let j = 0; j < 20; j++) {
            ctx.fillStyle = Math.random() > 0.5 ? '#6aaa64' : '#c9b458';
            ctx.fillRect(i * 50, j * 100, 30, 30);
        }
    }
    ctx.globalAlpha = 1.0;

    // Header
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 80px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`WORDLE ${REVIEW_YEAR}`, canvas.width / 2, 150);

    ctx.fillStyle = '#6aaa64';
    ctx.font = 'bold 60px Outfit, sans-serif';
    ctx.fillText('YEAR IN REVIEW', canvas.width / 2, 230);

    // Username
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 100px Outfit, sans-serif';
    ctx.fillText(stats.username.toUpperCase(), canvas.width / 2, 400);

    // Stats Grid
    const startY = 600;
    const gapY = 300;
    const col1X = 300;
    const col2X = 780;

    drawStat(ctx, 'PASSING RATE', Math.round(stats.passingRate) + '%', col1X, startY);
    drawStat(ctx, 'WINNING RATE', Math.round(stats.winningRate) + '%', col2X, startY);

    const months = {
        '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
        '05': 'May', '06': 'June', '07': 'July', '08': 'Aug',
        '09': 'Sept', '10': 'Oct', '11': 'Nov', '12': 'Dec'
    };
    // const bestMonthName = stats.bestMonth ? (months[stats.bestMonth.month] || stats.bestMonth.month) : '-';

    drawStat(ctx, 'LONGEST STREAK', stats.maxStreak + ' Days', col1X, startY + gapY);
    drawStat(ctx, 'TOTAL GAMES', stats.totalGames, col2X, startY + gapY);

    // Distribution
    const graphY = 1350;
    const graphHeight = 400;
    const graphWidth = 800;
    const graphX = (canvas.width - graphWidth) / 2;

    ctx.fillStyle = '#aaaaaa';
    ctx.font = 'bold 40px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('GUESS DISTRIBUTION', canvas.width / 2, graphY - 50);

    const maxVal = Math.max(...Object.values(stats.guessDistribution));
    const keys = ['1', '2', '3', '4', '5', '6', 'X'];
    const barWidth = (graphWidth / keys.length) - 20;

    keys.forEach((key, index) => {
        const count = stats.guessDistribution[key] || 0;
        const ratio = maxVal > 0 ? count / maxVal : 0;
        const barH = ratio * graphHeight;

        const x = graphX + (index * (barWidth + 20));
        const y = graphY + graphHeight - barH;

        // Bar
        ctx.fillStyle = key === 'X' ? '#3a3a3c' : '#6aaa64';
        if (ratio > 0) {
            ctx.shadowBlur = 10;
            ctx.shadowColor = 'rgba(0,0,0,0.3)';
            ctx.fillRect(x, y, barWidth, barH);
            ctx.shadowBlur = 0;
        }

        // Label
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 30px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(key, x + barWidth / 2, graphY + graphHeight + 40);

        // Value
        if (count > 0) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 30px Outfit, sans-serif';
            ctx.fillText(count, x + barWidth / 2, y - 10);
        }
    });

    // Footer
    ctx.fillStyle = '#555';
    ctx.font = '40px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`wordle.hax429.me/${REVIEW_YEAR}`, canvas.width / 2, canvas.height - 100);

    // Update Image
    const img = document.getElementById('poster-image');
    img.src = canvas.toDataURL('image/png');
}

function drawStat(ctx, label, value, x, y) {
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '36px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x, y);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 100px Outfit, sans-serif';
    // Add shadow
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(81, 141, 78, 0.4)';
    ctx.fillText(value, x, y + 110);
    ctx.shadowBlur = 0;
}

// Make global for button onclick
window.downloadPoster = function () {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;

    const link = document.createElement('a');
    link.download = `wordle-${REVIEW_YEAR}-${currentUsername}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
};

window.shareToDiscord = async function () {
    const canvas = document.getElementById('poster-canvas');
    if (!canvas) return;

    try {
        const dataUrl = canvas.toDataURL('image/png');
        const blob = await (await fetch(dataUrl)).blob();
        const file = new File([blob], `wordle-${REVIEW_YEAR}-${currentUsername}.png`, { type: 'image/png' });

        // Try native share first (mobile/supported browsers)
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            await navigator.share({
                files: [file],
                title: `Wordle ${REVIEW_YEAR} Replay`,
                text: `Check out my Wordle ${REVIEW_YEAR} stats!`
            });
            return;
        }

        // Fallback to Clipboard API
        if (navigator.clipboard && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    [blob.type]: blob
                })
            ]);

            // Visual feedback
            const btn = document.querySelector('button[onclick="shareToDiscord()"]');
            const originalText = btn.textContent;
            btn.textContent = 'Copied to Clipboard!';
            btn.style.background = '#43b581'; // Green success color

            setTimeout(() => {
                btn.textContent = originalText;
                btn.style.background = '#5865F2'; // Discord blurple
            }, 2000);
            return;
        }

        throw new Error('Sharing not supported');
    } catch (err) {
        console.error('Share failed:', err);
        // Fallback alert
        alert('Could not share automatically. Please download the image instead.');
    }
};

/* =========================================
   Background Animation
   ========================================= */
function initBackgroundAnimation() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let width, height;

    // Letters to use
    const letters = ['W', 'O', 'R', 'D', 'L', 'E'];
    // Lighter, more subtle opacity
    const colors = ['rgba(106, 170, 100, 0.05)', 'rgba(201, 180, 88, 0.05)', 'rgba(58, 58, 60, 0.05)'];

    let blocks = [];
    const blockSize = 60;

    // Mouse interaction
    let mouse = { x: -1000, y: -1000 };

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    window.addEventListener('touchmove', (e) => {
        if (e.touches.length > 0) {
            mouse.x = e.touches[0].clientX;
            mouse.y = e.touches[0].clientY;
        }
    });

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        canvas.width = width;
        canvas.height = height;
        initBlocks();
    }

    function initBlocks() {
        blocks = [];
        // Much fewer blocks - essentially "floating debris"
        // Density: 1 block per 20000 pixels roughly
        const count = Math.floor((width * height) / 25000);

        for (let i = 0; i < count; i++) {
            blocks.push({
                x: Math.random() * width,
                y: Math.random() * height,
                // Slow random drift
                vx: (Math.random() - 0.5) * 0.4,
                vy: (Math.random() - 0.5) * 0.4,
                activeVx: 0,
                activeVy: 0,
                letter: letters[Math.floor(Math.random() * letters.length)],
                color: colors[Math.floor(Math.random() * colors.length)],
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 0.002
            });
        }
    }

    function animate() {
        ctx.clearRect(0, 0, width, height);
        ctx.font = 'bold 24px Outfit, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        blocks.forEach(block => {
            // Mouse Repulsion
            const dist = Math.hypot(mouse.x - block.x, mouse.y - block.y);
            const maxDist = 200;

            if (dist < maxDist) {
                const angle = Math.atan2(mouse.y - block.y, mouse.x - block.x);
                const force = (maxDist - dist) / maxDist;
                const push = force * 0.5; // push strength

                // Add to active velocity (push away)
                block.activeVx -= Math.cos(angle) * push;
                block.activeVy -= Math.sin(angle) * push;
            }

            // Apply velocities
            block.x += block.vx + block.activeVx;
            block.y += block.vy + block.activeVy;
            block.rotation += block.rotSpeed;

            // Friction for active push
            block.activeVx *= 0.96;
            block.activeVy *= 0.96;

            // Wrap around screen
            if (block.x < -blockSize) block.x = width + blockSize;
            if (block.x > width + blockSize) block.x = -blockSize;
            if (block.y < -blockSize) block.y = height + blockSize;
            if (block.y > height + blockSize) block.y = -blockSize;

            // Draw
            ctx.save();
            ctx.translate(block.x, block.y);
            ctx.rotate(block.rotation);

            ctx.fillStyle = block.color;
            ctx.fillRect(-blockSize / 2, -blockSize / 2, blockSize, blockSize);

            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillText(block.letter, 0, 0);

            ctx.restore();
        });

        requestAnimationFrame(animate);
    }

    window.addEventListener('resize', resize);
    resize();
    window.addEventListener('resize', resize);
    resize();
    animate();
}

/* =========================================
   Printer/Drag Animation
   ========================================= */
function initPrinterInteraction() {
    const poster = document.getElementById('poster-image');
    const container = document.getElementById('printer-interaction-area');
    const buttons = document.getElementById('poster-buttons');
    const hint = document.getElementById('drag-hint');

    if (!poster || !container) return;

    let startY = 0;
    let currentY = -85; // Initial percent translateY
    let isDragging = false;
    let isPrinted = false;

    // Force initial state
    poster.style.transform = 'translateY(-85%)';

    // Helper to get Y position
    const getY = (e) => e.targetTouches ? e.targetTouches[0].clientY : e.clientY;

    const startDrag = (e) => {
        if (isPrinted) return;
        isDragging = true;
        startY = getY(e);
        poster.classList.add('dragging');
        // Prevent default touch scrolling
        if (e.cancelable) e.preventDefault();
    };

    const onDrag = (e) => {
        if (!isDragging || isPrinted) return;
        // if (e.cancelable) e.preventDefault(); // Optional based on UX

        const y = getY(e);
        const deltaY = y - startY;

        // Convert pixel delta to percentage approx (assuming container height ~400-500px)
        const containerHeight = container.offsetHeight;
        const deltaPercent = (deltaY / containerHeight) * 100;

        // Calculate new position
        // Initial is -85%, max is 0%
        let newPos = -85 + deltaPercent;

        // Clamp
        if (newPos < -90) newPos = -90; // Allow slight pull up
        if (newPos > 0) newPos = 0;

        poster.style.transform = `translateY(${newPos}%)`;

        // Visual feedback
        if (newPos > -10) {
            hint.style.opacity = 0;
        } else {
            hint.style.opacity = 1;
        }
    };

    const endDrag = () => {
        if (!isDragging || isPrinted) return;
        isDragging = false;
        poster.classList.remove('dragging');

        // Check current transform value manually or track it
        // We can just re-read the style or rely on logic limits
        // Let's parse the current transform from the style we set
        const transform = poster.style.transform;
        const match = transform.match(/translateY\(([-0-9.]+)%\)/);
        const currentVal = match ? parseFloat(match[1]) : -85;

        // Threshold to release: if pulled past -20%
        if (currentVal > -20) {
            // Success!
            isPrinted = true;
            poster.classList.add('printed');
            document.getElementById('poster-wrapper').classList.add('printed');
            poster.style.transform = ''; // remove inline so class takes over

            // Show buttons
            buttons.style.opacity = 1;
            buttons.style.pointerEvents = 'all';

            // Hide hint
            hint.style.display = 'none';

            // Confetti pop!
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.8 },
                colors: ['#6aaa64', '#c9b458', '#ffffff']
            });

        } else {
            // Snap back
            poster.style.transform = ''; // reverts to css default (-85%)
        }
    };

    // Mouse events
    poster.addEventListener('mousedown', startDrag);
    window.addEventListener('mousemove', onDrag);
    window.addEventListener('mouseup', endDrag);

    // Touch events
    poster.addEventListener('touchstart', startDrag, { passive: false });
    window.addEventListener('touchmove', onDrag, { passive: false });
    window.addEventListener('touchend', endDrag);
}

// Ensure init calls this
document.addEventListener('DOMContentLoaded', () => {
    // Other inits are likely called inside fetch
    // We can just wait for a bit or hook into the slide transition
    // But simplest is to run it; it attaches listeners to existing elements
    // The poster image exists but might not have src yet, which is fine for listeners
    initPrinterInteraction();
});
