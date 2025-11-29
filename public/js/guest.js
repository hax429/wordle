// Guest view JavaScript - handles all public-facing functionality

const GuestApp = {
    currentPeriod: 'all-time',
    videoElement: null,

    init() {
        console.log('🎯 GuestApp initializing...');
        this.setupEventListeners();
        this.initParticles();
        this.setupScrollReveal();
        this.loadAllData();
        this.initTheme();
    },

    setupEventListeners() {
        // Theme Toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => this.toggleTheme());
        }

        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadAllData();
        });

        // Period selector buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                // Get the button element, not the clicked child element
                const clickedBtn = e.currentTarget;

                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                clickedBtn.classList.add('active');
                this.currentPeriod = clickedBtn.dataset.period;
                this.loadStats();
            });
        });
    },

    initTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    },

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    },

    updateThemeIcon(theme) {
        const btn = document.getElementById('themeToggle');
        if (btn) {
            btn.textContent = theme === 'dark' ? '☀️' : '🌙';
        }
    },

    setupScrollReveal() {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('visible');

                    // Trigger typewriter if it's a section title
                    const title = entry.target.querySelector('.section-title-alt, .section-title-column, .section-title-scoreboard, .section-title-data, .section-title-video');
                    if (title && !title.dataset.typed) {
                        this.typeWriter(title);
                        title.dataset.typed = 'true';
                    }
                }
            });
        }, { threshold: 0.1 });

        document.querySelectorAll('section').forEach(section => {
            section.classList.add('hidden-section'); // Ensure CSS handles initial hidden state if needed, or rely on .visible
            observer.observe(section);
        });
    },

    typeWriter(element) {
        const text = element.innerText;
        element.innerHTML = '';
        let i = 0;
        const speed = 50;

        function type() {
            if (i < text.length) {
                element.innerHTML += text.charAt(i);
                i++;
                setTimeout(type, speed);
            }
        }
        type();
    },

    async loadAllData() {
        this.showLoading(true);
        try {
            await Promise.all([
                this.loadOverview(),
                this.loadStats(),
                this.loadPlotData(),
                this.loadVideos()
            ]);
        } catch (error) {
            this.showError('Failed to load data');
            console.error(error);
        } finally {
            this.showLoading(false);
        }
    },

    async loadOverview() {
        try {
            const response = await fetch('/api/overview');
            const data = await response.json();
            this.renderOverview(data);
        } catch (error) {
            console.error('Failed to load overview:', error);
        }
    },

    async loadStats() {
        try {
            const endpoint = this.currentPeriod === 'all-time'
                ? '/api/stats/all-time'
                : '/api/stats/last-week';

            console.log('📊 Loading stats from:', endpoint);
            const response = await fetch(endpoint);
            const data = await response.json();
            console.log('✓ Stats loaded:', data);
            console.log('✓ Rankings:', data.rankings);
            console.log('✓ Facts:', data.facts);
            this.renderRankings(data.rankings);
            this.renderFacts(data.facts);
        } catch (error) {
            console.error('❌ Failed to load stats:', error);
        }
    },

    async loadPlotData() {
        try {
            console.log('📈 Loading plot data...');
            const response = await fetch('/api/plot-data');
            const data = await response.json();
            console.log('✓ Plot data loaded:', data);
            console.log('✓ ChartUtils available:', typeof ChartUtils !== 'undefined');
            ChartUtils.createPlotlyChart('progressChart', data);
            console.log('✓ Chart created');
        } catch (error) {
            console.error('❌ Failed to load plot data:', error);
        }
    },

    async loadVideos() {
        try {
            console.log('🎬 Loading videos from /api/videos...');
            const response = await fetch('/api/videos');
            const data = await response.json();
            console.log('✓ Videos API response:', data);
            console.log('✓ Number of videos found:', data.videos?.length || 0);
            if (data.videos && data.videos.length > 0) {
                console.log('✓ Latest video:', data.videos[data.videos.length - 1]);
            }
            this.renderVideos(data.videos);
        } catch (error) {
            console.error('❌ Failed to load videos:', error);
        }
    },

    renderOverview(data) {
        const container = document.getElementById('overviewStats');

        const stats = [
            {
                icon: '📅',
                value: data.total_streaks,
                label: 'DAYS TRACKED',
                detail: 'Total days of data',
                color: 'green'
            },
            {
                icon: '👥',
                value: data.total_users,
                label: 'PLAYERS',
                detail: 'Active participants',
                color: 'yellow'
            },
            {
                icon: '🎯',
                value: data.total_entries,
                label: 'TOTAL GAMES',
                detail: 'Games played',
                color: 'green'
            },
            {
                icon: '🔢',
                value: data.total_guesses ? data.total_guesses.toLocaleString() : 0,
                label: 'TOTAL GUESSES',
                detail: 'All guesses since day 1',
                color: 'yellow'
            },
            {
                icon: '📊',
                value: data.total_entries > 0 ? (data.total_entries / data.total_users).toFixed(1) : 0,
                label: 'AVG GAMES/PLAYER',
                detail: 'Average per person',
                color: 'green'
            }
        ];

        container.innerHTML = stats.map(stat => `
            <div class="stat-card stat-card-${stat.color}">
                <div class="stat-card-inner">
                    <div class="stat-card-front">
                        <div class="stat-icon">${stat.icon}</div>
                        <div class="stat-label">${stat.label}</div>
                    </div>
                    <div class="stat-card-back">
                        <div class="stat-value">${stat.value}</div>
                        <div class="stat-label">${stat.label}</div>
                        <div class="stat-detail">${stat.detail}</div>
                    </div>
                </div>
            </div>
        `).join('');

        // Add click handlers for flip animation
        document.querySelectorAll('.stat-card').forEach(card => {
            card.addEventListener('click', () => {
                card.classList.toggle('flipped');
            });
        });
    },

    renderRankings(rankings) {
        console.log('🏅 Rendering rankings...', rankings);
        const container = document.getElementById('rankingsContainer');

        if (!rankings || Object.keys(rankings).length === 0) {
            console.warn('⚠️ No rankings data available');
            container.innerHTML = '<p style="text-align: center; color: #94a3b8;">No rankings available</p>';
            return;
        }

        let html = '';

        // Average Score Rankings
        if (rankings.average_score && rankings.average_score.length > 0) {
            html += this.createRankingCard(
                '🎯',
                'Best Average Score',
                rankings.average_score.slice(0, 10),
                (item) => item[1].average_score.toFixed(2),
                'avg score',
                (item) => `${item[1].games_played} games`
            );
        }

        // Participation Rankings
        if (rankings.participation && rankings.participation.length > 0) {
            html += this.createRankingCard(
                '📅',
                'Most Active Players',
                rankings.participation.slice(0, 10),
                (item) => item[1].days_participated || 0,
                'days',
                (item) => `${((item[1].participation_rate || 0) * 100).toFixed(0)}% participation`
            );
        }

        // Longest Streak Rankings
        if (rankings.longest_streak && rankings.longest_streak.length > 0) {
            html += this.createRankingCard(
                '🔥',
                'Longest Streaks',
                rankings.longest_streak.slice(0, 10),
                (item) => item[1].longest_streak || 0,
                'days',
                (item) => `${((item[1].consistency_score || 0) * 100).toFixed(0)}% consistent`
            );
        }

        container.innerHTML = html;
    },

    generateWordleGrid(title, username) {
        // Create a 5x5 Wordle-style grid based on achievement
        const patterns = {
            'Impossible Achievement': [
                ['W', 'O', 'R', 'D', 'L'],
                ['G', 'U', 'E', 'S', 'S'],
                ['O', 'N', 'E', '!', '!'],
                ['F', 'I', 'R', 'S', 'T'],
                ['T', 'R', 'Y', '!', '🎯']
            ],
            'Rising Star': [
                ['R', 'I', 'S', 'I', 'N'],
                ['G', 'S', 'T', 'A', 'R'],
                ['I', 'M', 'P', 'R', 'O'],
                ['V', 'I', 'N', 'G', '!'],
                ['📈', '⭐', '✨', '🔥', '💫']
            ],
            'Consistency King': [
                ['C', 'O', 'N', 'S', 'T'],
                ['A', 'N', 'T', 'L', 'Y'],
                ['G', 'R', 'E', 'A', 'T'],
                ['S', 'C', 'O', 'R', 'E'],
                ['👑', '🎖️', '⭐', '✨', '💎']
            ],
            'Perfect Scorer': [
                ['P', 'E', 'R', 'F', 'E'],
                ['C', 'T', 'S', 'C', 'O'],
                ['R', 'E', 'S', '!', '!'],
                ['T', 'W', 'O', 'S', '&'],
                ['T', 'H', 'R', 'E', 'E']
            ],
            'Comeback King': [
                ['N', 'E', 'V', 'E', 'R'],
                ['G', 'I', 'V', 'E', 'U'],
                ['P', '!', '!', '!', '5'],
                ['A', 'N', 'D', '6', 'S'],
                ['💪', '🔥', '💥', '⚡', '✨']
            ],
            'Weekend Warrior': [
                ['W', 'E', 'E', 'K', 'E'],
                ['N', 'D', 'V', 'I', 'B'],
                ['E', 'S', '!', '!', '!'],
                ['R', 'E', 'L', 'A', 'X'],
                ['🏖️', '☀️', '🌴', '😎', '🍹']
            ],
            'Century Club': [
                ['1', '0', '0', '+', '!'],
                ['G', 'A', 'M', 'E', 'S'],
                ['P', 'L', 'A', 'Y', 'E'],
                ['D', '!', '!', '!', '!'],
                ['💯', '🏆', '⭐', '✨', '💫']
            ],
            'Streak Master': [
                ['S', 'T', 'R', 'E', 'A'],
                ['K', 'M', 'A', 'S', 'T'],
                ['E', 'R', '!', '!', '!'],
                ['K', 'E', 'E', 'P', 'U'],
                ['P', '🔥', '⚡', '🏃', '💨']
            ]
        };

        const pattern = patterns[title] || [
            ['W', 'O', 'R', 'D', 'L'],
            ['E', '!', '!', '!', '!'],
            ['C', 'H', 'A', 'M', 'P'],
            ['I', 'O', 'N', '!', '!'],
            ['🏆', '⭐', '🎯', '✨', '💫']
        ];

        // Map each character to a tile state (correct=green, present=yellow, absent=gray)
        return pattern.map((row, rowIndex) => {
            return row.map((char, colIndex) => {
                let state;

                // Create interesting pattern: mostly green and yellow with some grays
                if (rowIndex === 4 || char.match(/[🎯📈👑💎💪🏆⭐✨🔥💫💥⚡🏖️☀️🌴😎🍹💯🏃💨]/)) {
                    state = 'correct'; // Green for bottom row and emojis
                } else if (char === '!' || rowIndex === 0 || (rowIndex + colIndex) % 3 === 0) {
                    state = 'present'; // Yellow for excitement and pattern
                } else if (char.match(/[A-Z0-9]/)) {
                    state = 'correct'; // Green for letters
                } else {
                    state = 'present'; // Yellow for numbers and special chars
                }

                return { char, state };
            });
        });
    },

    renderFacts(facts) {
        console.log('✨ Rendering facts...', facts);
        const container = document.getElementById('factsContainer');

        if (!facts || (facts.allTime?.length === 0 && facts.last7Days?.length === 0)) {
            console.warn('⚠️ No facts data available');
            container.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1/-1;">No interesting facts available yet. Keep playing!</p>';
            return;
        }

        const renderFactCard = (fact, index) => {
            const words = this.generateWordleGrid(fact.title, fact.username);
            return `
                <div class="achievement-wordle ${fact.highlight ? 'highlight' : ''}" data-index="${index}">
                    <div class="wordle-grid">
                        ${words.map((row, rowIndex) => `
                            <div class="wordle-row">
                                ${row.map((letter, colIndex) => {
                const delay = (rowIndex * 5 + colIndex) * 0.05;
                const state = letter.state;
                return `
                                        <div class="wordle-tile ${state}" style="animation-delay: ${delay}s">
                                            ${letter.char}
                                        </div>
                                    `;
            }).join('')}
                            </div>
                        `).join('')}
                    </div>
                    <div class="achievement-reveal">
                        <div class="achievement-badge">${fact.badge}</div>
                        <div class="achievement-info">
                            <div class="achievement-rank">#${index + 1}</div>
                            <div class="achievement-category">${fact.title}</div>
                            <div class="achievement-player">${this.escapeHtml(fact.username)}</div>
                            <div class="achievement-stats">${fact.detail}</div>
                        </div>
                    </div>
                </div>
            `;
        };

        let html = '';

        if (facts.allTime && facts.allTime.length > 0) {
            html += `
                <div class="facts-category">
                    <h3 class="category-title">ALL-TIME LEGENDS</h3>
                    <div class="wordle-hall-of-fame">
                        ${facts.allTime.map((fact, index) => renderFactCard(fact, index)).join('')}
                    </div>
                </div>
            `;
        }

        if (facts.last7Days && facts.last7Days.length > 0) {
            html += `
                <div class="facts-category" style="margin-top: 3rem;">
                    <h3 class="category-title">LAST 7 DAYS</h3>
                    <div class="wordle-hall-of-fame">
                        ${facts.last7Days.map((fact, index) => renderFactCard(fact, index)).join('')}
                    </div>
                </div>
            `;
        }

        container.innerHTML = html;

        // Trigger sequential tile flip animation
        setTimeout(() => {
            document.querySelectorAll('.achievement-wordle').forEach((card, cardIndex) => {
                setTimeout(() => {
                    card.classList.add('revealed');
                }, cardIndex * 400);
            });
        }, 100);
    },

    createRankingCard(icon, title, data, valueFunc, metric, detailsFunc) {
        // Split top 3 and rest
        const top3 = data.slice(0, 3);
        const rest = data.slice(3);

        // Create podium for top 3
        let podiumHtml = '';
        if (top3.length >= 1) {
            // Reorder: 2nd, 1st, 3rd for visual podium effect
            const podiumOrder = top3.length === 3 ? [top3[1], top3[0], top3[2]] :
                top3.length === 2 ? [top3[1], top3[0]] :
                    [top3[0]];
            const positions = top3.length === 3 ? [1, 0, 2] :
                top3.length === 2 ? [1, 0] : [0];

            podiumHtml = `
                <div class="podium-container">
                    ${podiumOrder.map((item, visualIndex) => {
                const actualIndex = positions[visualIndex];
                const [username, stats] = item;
                const podiumClass = actualIndex === 0 ? 'first' : actualIndex === 1 ? 'second' : 'third';
                const medal = ChartUtils.getMedal(actualIndex);
                const height = actualIndex === 0 ? '100%' : actualIndex === 1 ? '80%' : '60%';

                return `
                            <div class="podium-item podium-${podiumClass}" style="--podium-height: ${height}">
                                <div class="podium-user">
                                    <div class="podium-medal">${medal}</div>
                                    <div class="podium-username">${this.escapeHtml(username)}</div>
                                    <div class="podium-value">${valueFunc(item)}</div>
                                    <div class="podium-metric">${metric}</div>
                                    ${detailsFunc ? `<div class="podium-details">${detailsFunc(item)}</div>` : ''}
                                </div>
                                <div class="podium-base">
                                    <div class="podium-rank">#${actualIndex + 1}</div>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        // Create regular list for the rest
        let restHtml = '';
        if (rest.length > 0) {
            restHtml = `
                <div class="ranking-list-rest">
                    ${rest.map(([username, stats], idx) => {
                const actualIndex = idx + 3;
                return `
                            <div class="ranking-item-simple">
                                <div class="ranking-simple-left">
                                    <span class="ranking-simple-position">#${actualIndex + 1}</span>
                                    <span class="ranking-simple-username">${this.escapeHtml(username)}</span>
                                </div>
                                <div class="ranking-simple-right">
                                    <span class="ranking-simple-value">${valueFunc([username, stats])}</span>
                                    <span class="ranking-simple-metric">${metric}</span>
                                </div>
                            </div>
                        `;
            }).join('')}
                </div>
            `;
        }

        return `
            <div class="ranking-card">
                <div class="ranking-header">
                    <div class="ranking-icon">${icon}</div>
                    <div class="ranking-title">${title}</div>
                </div>
                ${podiumHtml}
                ${restHtml}
            </div>
        `;
    },

    renderVideos(videos) {
        console.log('🎬 renderVideos called with:', videos);
        const container = document.getElementById('videoContainer');

        if (!videos || videos.length === 0) {
            console.log('⚠️ No videos to display');
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #94a3b8;">
                    <p style="font-size: 3rem; margin-bottom: 1rem;">🎬</p>
                    <p style="font-size: 1.25rem; margin-bottom: 0.5rem;">No videos available yet</p>
                    <p style="font-size: 0.875rem;">Videos will appear here once generated by an admin</p>
                </div>
            `;
            return;
        }

        // Show the most recent video
        const latestVideo = videos[videos.length - 1];
        const sizeInMB = (latestVideo.size / (1024 * 1024)).toFixed(1);
        console.log('✓ Rendering latest video:', latestVideo.filename, `(${sizeInMB} MB)`);

        // Detect connection speed (rough estimate)
        const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
        const isSlowConnection = connection && (connection.effectiveType === 'slow-2g' || connection.effectiveType === '2g' || connection.effectiveType === '3g' || connection.saveData);

        console.log('🌐 Connection type:', connection?.effectiveType || 'unknown');
        console.log('🌐 Save data mode:', connection?.saveData || false);

        let html = `
            <div class="video-wrapper">
                <div class="video-lazy-container" data-video-url="${latestVideo.url}" data-video-size="${sizeInMB}">
                    ${isSlowConnection ? `
                        <div class="video-lazy-placeholder">
                            <div class="video-lazy-icon">🎬</div>
                            <div class="video-lazy-text">
                                <h3>Video Ready to Load</h3>
                                <p>Video size: ${sizeInMB} MB</p>
                                <p style="color: #94a3b8; font-size: 0.875rem;">We detected a slower connection</p>
                                <button class="btn btn-primary video-load-btn">
                                    <span>▶️</span> Load Video
                                </button>
                            </div>
                        </div>
                    ` : `
                        <video class="video-player" preload="metadata" playsinline>
                            <source src="${latestVideo.url}" type="video/mp4">
                            Your browser does not support the video tag.
                        </video>
                        <div class="video-loading-overlay" style="display: none;">
                            <div class="spinner"></div>
                            <p>Loading video...</p>
                        </div>
                    `}
                </div>
            </div>
        `;

        // Show list of all videos if there are multiple
        if (videos.length > 1) {
            html += '<div class="video-list">';
            videos.forEach(video => {
                const videoSizeInMB = (video.size / (1024 * 1024)).toFixed(1);
                html += `
                    <div class="video-item">
                        <div>
                            <strong>${video.filename}</strong>
                            <br>
                            <small style="color: #94a3b8;">${videoSizeInMB} MB</small>
                        </div>
                        <a href="${video.url}" download class="btn btn-secondary">
                            <span>⬇️</span> Download
                        </a>
                    </div>
                `;
            });
            html += '</div>';
        }

        console.log('✓ Injecting video HTML into container');
        container.innerHTML = html;

        // Handle lazy loading
        const lazyContainer = container.querySelector('.video-lazy-container');
        const loadBtn = container.querySelector('.video-load-btn');

        if (loadBtn && lazyContainer) {
            console.log('✓ Lazy load button found, attaching listener');
            loadBtn.addEventListener('click', () => {
                this.loadVideoLazy(lazyContainer);
            });
        } else {
            // Auto-load video
            const videoElement = container.querySelector('.video-player');
            if (videoElement) {
                console.log('✓ Video element found, setting up controls');
                this.setupVideoControls(videoElement);
            } else {
                console.error('❌ Video element not found in DOM');
            }
        }
    },

    loadVideoLazy(container) {
        console.log('🎬 Loading video lazily...');
        const videoUrl = container.dataset.videoUrl;
        const placeholder = container.querySelector('.video-lazy-placeholder');

        // Show loading state
        placeholder.innerHTML = `
            <div class="video-loading-overlay">
                <div class="spinner"></div>
                <p>Loading video...</p>
            </div>
        `;

        // Create video element
        const video = document.createElement('video');
        video.className = 'video-player';
        video.setAttribute('preload', 'metadata');
        video.setAttribute('playsinline', '');

        const source = document.createElement('source');
        source.src = videoUrl;
        source.type = 'video/mp4';

        video.appendChild(source);

        // Wait for video to be ready
        video.addEventListener('canplay', () => {
            console.log('✓ Lazy-loaded video ready');
            placeholder.remove();
            container.appendChild(video);
            this.setupVideoControls(video);
        });

        video.addEventListener('error', () => {
            console.error('❌ Error loading lazy video');
            placeholder.innerHTML = `
                <div class="video-lazy-placeholder">
                    <div class="video-lazy-icon">❌</div>
                    <div class="video-lazy-text">
                        <h3>Failed to Load Video</h3>
                        <p>Please check your connection and try again</p>
                        <button class="btn btn-primary video-load-btn">
                            <span>🔄</span> Retry
                        </button>
                    </div>
                </div>
            `;

            const retryBtn = placeholder.querySelector('.video-load-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    this.loadVideoLazy(container);
                });
            }
        });

        // Trigger load
        video.load();
    },

    showLoading(show) {
        const spinner = document.getElementById('loadingSpinner');
        spinner.style.display = show ? 'flex' : 'none';
    },

    showError(message) {
        const toast = document.getElementById('errorToast');
        const messageEl = document.getElementById('errorMessage');

        messageEl.textContent = message;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
    },

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    },

    // Wordle Letter Tile Background Animation
    initParticles() {
        const canvas = document.getElementById('particles-canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const tiles = [];
        const tileCount = 30;
        const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
        const colors = ['#518D4E', '#B69F3A', '#5a66ff', '#787c7e'];

        class WordleTile {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = Math.random() * canvas.height;
                this.size = Math.random() * 40 + 30; // 30-70px tiles
                this.baseSpeedX = Math.random() * 0.4 - 0.2;
                this.baseSpeedY = Math.random() * 0.4 - 0.2;
                this.speedX = this.baseSpeedX;
                this.speedY = this.baseSpeedY;
                this.opacity = Math.random() * 0.4 + 0.1;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = Math.random() * 0.5 - 0.25;
                this.letter = letters[Math.floor(Math.random() * letters.length)];
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update(mouseX, mouseY) {
                // Mouse interaction
                if (mouseX && mouseY) {
                    const dx = this.x - mouseX;
                    const dy = this.y - mouseY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const forceDirectionX = dx / distance;
                    const forceDirectionY = dy / distance;
                    const maxDistance = 150;
                    const force = (maxDistance - distance) / maxDistance;

                    if (distance < maxDistance) {
                        this.speedX += forceDirectionX * force * 0.5;
                        this.speedY += forceDirectionY * force * 0.5;
                    }
                }

                // Return to base speed
                this.speedX += (this.baseSpeedX - this.speedX) * 0.05;
                this.speedY += (this.baseSpeedY - this.speedY) * 0.05;

                this.x += this.speedX;
                this.y += this.speedY;
                this.rotation += this.rotationSpeed;

                // Wrap around screen
                if (this.x > canvas.width + this.size) this.x = -this.size;
                if (this.x < -this.size) this.x = canvas.width + this.size;
                if (this.y > canvas.height + this.size) this.y = -this.size;
                if (this.y < -this.size) this.y = canvas.height + this.size;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate((this.rotation * Math.PI) / 180);

                // Draw tile border
                ctx.strokeStyle = `rgba(58, 58, 60, ${this.opacity})`;
                ctx.lineWidth = 3;
                ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);

                // Draw tile background
                ctx.fillStyle = `rgba(${this.hexToRgb(this.color)}, ${this.opacity * 0.5})`;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);

                // Draw letter
                ctx.fillStyle = `rgba(255, 255, 255, ${this.opacity * 0.8})`;
                ctx.font = `bold ${this.size * 0.6}px "Bebas Neue", sans-serif`;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this.letter, 0, this.size * 0.05);

                ctx.restore();
            }

            hexToRgb(hex) {
                const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
                return result
                    ? `${parseInt(result[1], 16)}, ${parseInt(result[2], 16)}, ${parseInt(result[3], 16)}`
                    : '120, 120, 120';
            }
        }

        for (let i = 0; i < tileCount; i++) {
            tiles.push(new WordleTile());
        }

        let mouseX = null;
        let mouseY = null;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.x;
            mouseY = e.y;
        });

        window.addEventListener('mouseout', () => {
            mouseX = null;
            mouseY = null;
        });

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            tiles.forEach(tile => {
                tile.update(mouseX, mouseY);
                tile.draw();
            });

            requestAnimationFrame(animate);
        }

        animate();

        window.addEventListener('resize', () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        });
    },

    // Confetti Animation - Wordle Colors
    triggerConfetti() {
        const canvas = document.getElementById('confetti-canvas');
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;

        const confetti = [];
        const confettiCount = 150;
        const colors = ['#518D4E', '#B69F3A', '#5a66ff', '#000000', '#ffffff', '#787c7e'];

        class Confetto {
            constructor() {
                this.x = Math.random() * canvas.width;
                this.y = -10;
                this.size = Math.random() * 8 + 4;
                this.speedY = Math.random() * 3 + 2;
                this.speedX = Math.random() * 2 - 1;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = Math.random() * 10 - 5;
                this.color = colors[Math.floor(Math.random() * colors.length)];
            }

            update() {
                this.y += this.speedY;
                this.x += this.speedX;
                this.rotation += this.rotationSpeed;
                this.speedY += 0.1; // Gravity
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate(this.rotation * Math.PI / 180);
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
                ctx.restore();
            }
        }

        for (let i = 0; i < confettiCount; i++) {
            confetti.push(new Confetto());
        }

        let animationFrameId;
        function animateConfetti() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            confetti.forEach((c, index) => {
                c.update();
                c.draw();

                if (c.y > canvas.height) {
                    confetti.splice(index, 1);
                }
            });

            if (confetti.length > 0) {
                animationFrameId = requestAnimationFrame(animateConfetti);
            } else {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }

        animateConfetti();
    },

    // Setup Video Controls
    setupVideoControls(video) {
        console.log('🎮 setupVideoControls called');
        if (!video) {
            console.error('❌ Video element not found');
            return;
        }

        console.log('✓ Video element:', video);
        console.log('✓ Video src:', video.querySelector('source')?.src);
        console.log('✓ Video readyState:', video.readyState);
        console.log('✓ Video networkState:', video.networkState);

        this.videoElement = video;
        const wrapper = video.parentElement;
        console.log('✓ Video wrapper:', wrapper);

        // Create control overlay
        const controls = document.createElement('div');
        controls.className = 'video-controls';
        controls.innerHTML = `
            <button class="play-pause-btn" aria-label="Play/Pause">
                <svg viewBox="0 0 24 24" class="play-icon">
                    <path d="M8 5v14l11-7z"/>
                </svg>
                <svg viewBox="0 0 24 24" class="pause-icon" style="display: none;">
                    <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/>
                </svg>
            </button>
        `;

        // Create progress bar
        const progressBar = document.createElement('div');
        progressBar.className = 'video-progress-bar';
        progressBar.innerHTML = '<div class="video-progress-filled"></div>';

        wrapper.appendChild(controls);
        wrapper.appendChild(progressBar);
        console.log('✓ Controls and progress bar added to wrapper');

        const playPauseBtn = controls.querySelector('.play-pause-btn');
        const playIcon = controls.querySelector('.play-icon');
        const pauseIcon = controls.querySelector('.pause-icon');
        const progressFilled = progressBar.querySelector('.video-progress-filled');
        console.log('✓ Control elements found:', { playPauseBtn, playIcon, pauseIcon, progressFilled });

        // Play/Pause functionality
        const togglePlayPause = (e) => {
            console.log('▶️ togglePlayPause called, video.paused:', video.paused);
            e.stopPropagation();
            if (video.paused) {
                console.log('▶️ Attempting to play video...');
                const playPromise = video.play();
                if (playPromise !== undefined) {
                    playPromise
                        .then(() => {
                            console.log('✓ Video playing successfully');
                            playIcon.style.display = 'none';
                            pauseIcon.style.display = 'block';
                            controls.classList.add('hidden');
                        })
                        .catch(error => {
                            console.error('❌ Error playing video:', error);
                            console.error('❌ Error name:', error.name);
                            console.error('❌ Error message:', error.message);
                            this.showError('Unable to play video: ' + error.message);
                        });
                }
            } else {
                console.log('⏸️ Pausing video...');
                video.pause();
                playIcon.style.display = 'block';
                pauseIcon.style.display = 'none';
                controls.classList.remove('hidden');
                console.log('✓ Video paused');
            }
        };

        console.log('✓ Adding click event listeners to play button and video');
        playPauseBtn.addEventListener('click', togglePlayPause);
        video.addEventListener('click', togglePlayPause);

        // Show controls when paused
        video.addEventListener('pause', () => {
            console.log('📍 Video pause event fired');
            controls.classList.remove('hidden');
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
        });

        video.addEventListener('play', () => {
            console.log('📍 Video play event fired');
            controls.classList.add('hidden');
        });

        // Show controls when video ends
        video.addEventListener('ended', () => {
            console.log('📍 Video ended event fired');
            controls.classList.remove('hidden');
            playIcon.style.display = 'block';
            pauseIcon.style.display = 'none';
            video.currentTime = 0;
        });

        // Update progress bar
        video.addEventListener('timeupdate', () => {
            if (!isNaN(video.duration) && video.duration > 0) {
                const progress = (video.currentTime / video.duration) * 100;
                progressFilled.style.width = `${progress}%`;
            }
        });

        // Waiting for data
        video.addEventListener('waiting', () => {
            console.log('⏳ Video waiting for data...');
        });

        video.addEventListener('canplay', () => {
            console.log('✓ Video can start playing (canplay event)');
        });

        video.addEventListener('canplaythrough', () => {
            console.log('✓ Video can play through without buffering (canplaythrough event)');
        });

        // Error handling
        video.addEventListener('error', (e) => {
            console.error('❌ Video error event:', e);
            const error = video.error;
            if (error) {
                console.error('❌ Video error code:', error.code);
                console.error('❌ Video error message:', error.message);
                const errorMessages = {
                    1: 'MEDIA_ERR_ABORTED - Video loading aborted',
                    2: 'MEDIA_ERR_NETWORK - Network error while loading video',
                    3: 'MEDIA_ERR_DECODE - Video decoding failed',
                    4: 'MEDIA_ERR_SRC_NOT_SUPPORTED - Video format not supported'
                };
                console.error('❌ Error details:', errorMessages[error.code] || 'Unknown error');
            }
            this.showError('Error loading video');
        });

        let stallTimeout;
        video.addEventListener('stalled', () => {
            console.warn('⚠️ Video download stalled');
            console.warn('⚠️ This may indicate network issues or CORS problems');
            console.warn('⚠️ Video URL:', video.querySelector('source')?.src);

            // Show user-friendly message if stalled for too long
            clearTimeout(stallTimeout);
            stallTimeout = setTimeout(() => {
                if (video.networkState === 3) { // NETWORK_NO_SOURCE
                    console.error('❌ Video failed to load - network state indicates no source');
                    this.showError('Video is taking too long to load. Please check your connection.');
                }
            }, 10000); // 10 seconds
        });

        video.addEventListener('suspend', () => {
            console.log('📍 Video download suspended (browser is not fetching data)');
        });

        // Seek functionality
        progressBar.addEventListener('click', (e) => {
            e.stopPropagation();
            const rect = progressBar.getBoundingClientRect();
            const pos = (e.clientX - rect.left) / rect.width;
            if (!isNaN(video.duration) && video.duration > 0) {
                video.currentTime = pos * video.duration;
            }
        });

        // Touch seek for mobile
        progressBar.addEventListener('touchend', (e) => {
            e.stopPropagation();
            e.preventDefault();
            const touch = e.changedTouches[0];
            const rect = progressBar.getBoundingClientRect();
            const pos = (touch.clientX - rect.left) / rect.width;
            if (!isNaN(video.duration) && video.duration > 0) {
                video.currentTime = pos * video.duration;
            }
        });

        // Show controls on hover (desktop)
        wrapper.addEventListener('mouseenter', () => {
            if (video.paused) {
                controls.classList.remove('hidden');
            }
        });

        // Mobile touch support
        let touchTimeout;
        wrapper.addEventListener('touchstart', (e) => {
            // Don't prevent default on the wrapper itself
            controls.classList.remove('hidden');
            clearTimeout(touchTimeout);
            touchTimeout = setTimeout(() => {
                if (!video.paused) {
                    controls.classList.add('hidden');
                }
            }, 3000);
        });

        // Log when video is ready
        video.addEventListener('loadedmetadata', () => {
            console.log('✓ Video metadata loaded');
            console.log('✓ Video duration:', video.duration, 'seconds');
            console.log('✓ Video dimensions:', video.videoWidth, 'x', video.videoHeight);
            console.log('✓ Video readyState:', video.readyState);
        });

        video.addEventListener('loadeddata', () => {
            console.log('✓ First frame of video loaded');
        });

        video.addEventListener('loadstart', () => {
            console.log('📍 Video loading started');
        });

        video.addEventListener('progress', () => {
            if (video.buffered.length > 0) {
                const bufferedEnd = video.buffered.end(video.buffered.length - 1);
                const duration = video.duration;
                if (duration > 0) {
                    const bufferedPercent = (bufferedEnd / duration) * 100;
                    console.log(`📊 Video buffered: ${bufferedPercent.toFixed(1)}%`);
                }
            }
        });

        console.log('✓ All video event listeners attached successfully');
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GuestApp.init();

    // Trigger confetti on first load (optional - you can remove this if you want)
    setTimeout(() => {
        GuestApp.triggerConfetti();
    }, 1000);
});


