// Guest view JavaScript - handles all public-facing functionality

const GuestApp = {
    currentPeriod: 'all-time',
    
    init() {
        this.setupEventListeners();
        this.loadAllData();
    },

    setupEventListeners() {
        // Refresh button
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadAllData();
        });

        // Period selector buttons
        document.querySelectorAll('.period-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.period-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentPeriod = e.target.dataset.period;
                this.loadStats();
            });
        });
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
            
            const response = await fetch(endpoint);
            const data = await response.json();
            this.renderRankings(data.rankings);
        } catch (error) {
            console.error('Failed to load stats:', error);
        }
    },

    async loadPlotData() {
        try {
            const response = await fetch('/api/plot-data');
            const data = await response.json();
            ChartUtils.createPlotlyChart('progressChart', data);
        } catch (error) {
            console.error('Failed to load plot data:', error);
        }
    },

    async loadVideos() {
        try {
            const response = await fetch('/api/videos');
            const data = await response.json();
            this.renderVideos(data.videos);
        } catch (error) {
            console.error('Failed to load videos:', error);
        }
    },

    renderOverview(data) {
        const container = document.getElementById('overviewStats');
        
        container.innerHTML = `
            <div class="stat-card">
                <div class="stat-icon">📅</div>
                <div class="stat-value">${data.total_streaks}</div>
                <div class="stat-label">Days Tracked</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">👥</div>
                <div class="stat-value">${data.total_users}</div>
                <div class="stat-label">Players</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">🎯</div>
                <div class="stat-value">${data.total_entries}</div>
                <div class="stat-label">Total Games</div>
            </div>
            <div class="stat-card">
                <div class="stat-icon">📊</div>
                <div class="stat-value">${data.total_entries > 0 ? (data.total_entries / data.total_users).toFixed(1) : 0}</div>
                <div class="stat-label">Avg Games/Player</div>
            </div>
        `;
    },

    renderRankings(rankings) {
        const container = document.getElementById('rankingsContainer');
        
        if (!rankings || Object.keys(rankings).length === 0) {
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

    createRankingCard(icon, title, data, valueFunc, metric, detailsFunc) {
        let items = '';
        
        data.forEach(([username, stats], index) => {
            const topClass = index < 3 ? ' top-3' : '';
            const positionClass = index === 0 ? ' gold' : index === 1 ? ' silver' : index === 2 ? ' bronze' : '';
            
            items += `
                <div class="ranking-item${topClass}">
                    <div class="ranking-item-left">
                        <div class="ranking-position${positionClass}">
                            ${index < 3 ? ChartUtils.getMedal(index) : index + 1}
                        </div>
                        <div>
                            <div class="ranking-username">${this.escapeHtml(username)}</div>
                            <div class="ranking-details">${detailsFunc ? detailsFunc([username, stats]) : ''}</div>
                        </div>
                    </div>
                    <div class="ranking-item-right">
                        <div class="ranking-value">${valueFunc([username, stats])}</div>
                        <div class="ranking-metric">${metric}</div>
                    </div>
                </div>
            `;
        });

        return `
            <div class="ranking-card">
                <div class="ranking-header">
                    <div class="ranking-icon">${icon}</div>
                    <div class="ranking-title">${title}</div>
                </div>
                <div class="ranking-list">
                    ${items}
                </div>
            </div>
        `;
    },

    renderVideos(videos) {
        const container = document.getElementById('videoContainer');
        
        if (!videos || videos.length === 0) {
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
        
        let html = `
            <video class="video-player" controls>
                <source src="${latestVideo.url}" type="video/mp4">
                Your browser does not support the video tag.
            </video>
        `;

        // Show list of all videos if there are multiple
        if (videos.length > 1) {
            html += '<div class="video-list">';
            videos.forEach(video => {
                const sizeInMB = (video.size / (1024 * 1024)).toFixed(1);
                html += `
                    <div class="video-item">
                        <div>
                            <strong>${video.filename}</strong>
                            <br>
                            <small style="color: #94a3b8;">${sizeInMB} MB</small>
                        </div>
                        <a href="${video.url}" download class="btn btn-secondary">
                            <span>⬇️</span> Download
                        </a>
                    </div>
                `;
            });
            html += '</div>';
        }

        container.innerHTML = html;
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    GuestApp.init();
});


