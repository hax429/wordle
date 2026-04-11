// Admin console JavaScript

const AdminApp = {
    token: null,
    currentDay: null,
    usernames: {},

    resolveName(userId) {
        return this.usernames[userId] || userId;
    },

    async loadUsernames() {
        try {
            const response = await fetch('/api/usernames');
            this.usernames = await response.json();
        } catch (e) {
            console.error('Failed to load usernames:', e);
        }
    },

    getDateFromDay(day) {
        // Anchor: Day 218 represents December 23, 2025
        const anchorDay = 218;
        // Month is 0-indexed (11 = December)
        const anchorDate = new Date(2025, 11, 23);
        const diffDays = day - anchorDay;
        const targetDate = new Date(anchorDate);
        targetDate.setDate(anchorDate.getDate() + diffDays);
        return targetDate;
    },

    init() {
        this.checkAuth();
        this.setupEventListeners();
    },

    checkAuth() {
        this.token = localStorage.getItem('adminToken');

        if (this.token) {
            this.verifyToken();
        } else {
            this.showLoginScreen();
        }
    },

    async verifyToken() {
        try {
            const response = await fetch('/api/admin/verify', {
                headers: {
                    'Authorization': `Bearer ${this.token}`
                }
            });

            if (response.ok) {
                this.showDashboard();
                this.loadDashboardData();
            } else {
                this.showLoginScreen();
            }
        } catch (error) {
            this.showLoginScreen();
        }
    },

    setupEventListeners() {
        // Login form
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout button
        document.getElementById('logoutBtn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Tab Navigation
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.tab);
            });
        });

        // Sub-tab Navigation
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.switchSubTab(e.target.dataset.subtab);
            });
        });

        // Day Selector
        document.getElementById('daySelector').addEventListener('change', (e) => {
            this.loadResults(e.target.value);
        });

        // Result Form
        document.getElementById('resultForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSaveResult();
        });

        // Import form
        document.getElementById('importForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleImport();
        });

        // Video form
        document.getElementById('videoForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleGenerateVideo();
        });

        // Backup button
        document.getElementById('backupBtn').addEventListener('click', () => {
            this.handleBackup();
        });

        // Clear database button
        document.getElementById('clearDbBtn').addEventListener('click', () => {
            this.handleClearDatabase();
        });
    },

    // --- Navigation ---

    switchTab(tabId) {
        // Update buttons
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tab === tabId);
        });

        // Update content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.toggle('active', content.id === tabId);
        });

        // Load data if needed
        if (tabId === 'data') {
            this.loadDataManagement();
        } else if (tabId === 'settings') {
            this.loadSettings();
        }
    },

    switchSubTab(subTabId) {
        document.querySelectorAll('.sub-tab-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.subtab === subTabId);
        });

        document.querySelectorAll('.sub-tab-content').forEach(content => {
            content.classList.toggle('active', content.id === subTabId);
        });
    },

    // --- Settings Management ---

    async loadSettings() {
        try {
            // Fetch settings (managed in .env)
            const response = await this.authorizedFetch(`/api/admin/settings?t=${Date.now()}`);
            const settings = await response.json();

            document.getElementById('togglePlot').checked = settings.visibility_plot === 'true';
            document.getElementById('toggleVideo').checked = settings.visibility_video === 'true';
            document.getElementById('toggleStats').checked = settings.visibility_stats === 'true';
            document.getElementById('toggleHallOfFame').checked = settings.visibility_hall_of_fame === 'true';
            document.getElementById('toggle2025').checked = settings.visibility_2025 === 'true';
        } catch (error) {
            this.showError('Failed to load settings');
        }
    },

    async updateSettings() {
        const settings = {
            visibility_plot: document.getElementById('togglePlot').checked,
            visibility_video: document.getElementById('toggleVideo').checked,
            visibility_stats: document.getElementById('toggleStats').checked,
            visibility_hall_of_fame: document.getElementById('toggleHallOfFame').checked,
            visibility_2025: document.getElementById('toggle2025').checked
        };

        try {
            const response = await this.authorizedFetch('/api/admin/settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(settings)
            });

            if (response.ok) {
                this.showSuccess('Settings updated');
            } else {
                this.showError('Failed to update settings');
            }
        } catch (error) {
            this.showError('Failed to update settings');
        }
    },

    // --- Data Management ---

    async loadDataManagement() {
        await this.loadDaysForSelector();
        await this.loadUsers();
    },

    async loadDaysForSelector() {
        try {
            const response = await this.authorizedFetch(`/api/admin/days?t=${Date.now()}`);
            const data = await response.json();
            const selector = document.getElementById('daySelector');

            selector.innerHTML = '';
            data.days.reverse().forEach(item => {
                const option = document.createElement('option');
                // Handle both old (number) and new (object) format
                const day = typeof item === 'object' ? item.day : item;
                let date = typeof item === 'object' ? item.date : null;

                // Fallback client-side calculation if date is missing
                if (!date) {
                    date = this.getDateFromDay(day);
                }

                option.value = day;
                let dateStr = '';
                if (date) {
                    const d = new Date(date);
                    // Format: "Dec 22, 2025"
                    // Add 12 hours to avoid timezone issues pushing it to previous day
                    const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 12 * 60 * 60 * 1000);
                    dateStr = ` - ${utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
                }
                option.textContent = `Day ${day}${dateStr}`;
                selector.appendChild(option);
            });

            if (data.days.length > 0) {
                // Selector expects value (day number)
                const firstItem = data.days[0];
                const firstDay = typeof firstItem === 'object' ? firstItem.day : firstItem;
                this.loadResults(firstDay);
            }
        } catch (error) {
            console.error('Failed to load days:', error);
        }
    },

    async loadResults(day) {
        this.currentDay = day;
        this.showLoading(true);
        try {
            const response = await this.authorizedFetch(`/api/admin/day/${day}?t=${Date.now()}`);
            const data = await response.json();
            this.renderResultsTable(data.results);
        } catch (error) {
            this.showError(`Failed to load results for Day ${day}`);
        } finally {
            this.showLoading(false);
        }
    },

    renderResultsTable(results) {
        const container = document.getElementById('resultsTableContainer');

        if (!results || results.length === 0) {
            container.innerHTML = '<p class="text-muted p-3">No results found for this day.</p>';
            return;
        }

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Username</th>
                        <th>Score</th>
                        <th>Winner</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        results.forEach(r => {
            const userId = r.user_id;
            const displayName = this.escapeHtml(this.resolveName(userId));
            html += `
                <tr>
                    <td title="${userId}">${displayName}</td>
                    <td>${r.score}/6</td>
                    <td>${r.is_winner ? '👑' : '-'}</td>
                    <td>
                        <button class="btn btn-sm btn-secondary" onclick="AdminApp.editResult('${userId}', '${r.score}', ${r.is_winner})">Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteResult('${userId}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    async loadUsers() {
        // We'll use the database info endpoint to get users for now
        try {
            const response = await this.authorizedFetch(`/api/admin/database-info?t=${Date.now()}`);
            const data = await response.json();
            this.renderUsersTable(data.users);
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    },

    renderUsersTable(users) {
        const container = document.getElementById('usersTableContainer');

        if (!users || users.length === 0) {
            container.innerHTML = '<p class="text-muted p-3">No users found.</p>';
            return;
        }

        let html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Username</th>
                        <th>First Seen</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
        `;

        users.forEach(u => {
            const displayName = this.escapeHtml(this.resolveName(u.user_id));
            html += `
                <tr>
                    <td>${u.id}</td>
                    <td title="${u.user_id}">${displayName}</td>
                    <td>${new Date(u.first_seen).toLocaleDateString()}</td>
                    <td>
                        <button class="btn btn-sm btn-danger" onclick="AdminApp.deleteUser(${u.id}, '${u.user_id}')">Delete</button>
                    </td>
                </tr>
            `;
        });

        html += '</tbody></table>';
        container.innerHTML = html;
    },

    // --- Actions ---

    openAddResultModal() {
        document.getElementById('modalTitle').textContent = 'Add Result';
        document.getElementById('resultDay').value = this.currentDay || '';
        document.getElementById('resultUser').value = '';
        document.getElementById('resultScore').value = '1';
        document.getElementById('resultWinner').checked = false;
        document.getElementById('resultUser').disabled = false;

        document.getElementById('resultModal').style.display = 'flex';
    },

    editResult(username, score, isWinner) {
        document.getElementById('modalTitle').textContent = 'Edit Result';
        document.getElementById('resultDay').value = this.currentDay;
        document.getElementById('resultUser').value = username;
        document.getElementById('resultScore').value = score;
        document.getElementById('resultWinner').checked = isWinner;
        // document.getElementById('resultUser').disabled = true; // Allow editing username to create new entry effectively or fix typos

        document.getElementById('resultModal').style.display = 'flex';
    },

    closeModal() {
        document.getElementById('resultModal').style.display = 'none';
    },

    async generateVideo() {
        const type = document.getElementById('videoType').value;
        const fps = document.getElementById('videoFps').value;
        const modal = document.getElementById('progressModal');
        const statusEl = document.getElementById('progressStatus');

        // Show Modal
        modal.style.display = 'flex';
        statusEl.textContent = 'Starting video generation...';

        try {
            const response = await this.authorizedFetch('/api/admin/video/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type, fps: parseInt(fps) })
            });

            const data = await response.json();

            if (data.success) {
                statusEl.textContent = 'Generating frames... This may take a minute.';
                this.pollForVideoCompletion(data.filename);
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            this.showError('Failed to start generation: ' + error.message);
            modal.style.display = 'none';
        }
    },

    async pollForVideoCompletion(filename) {
        const statusEl = document.getElementById('progressStatus');
        const modal = document.getElementById('progressModal');
        let attempts = 0;
        const maxAttempts = 60; // 2 minutes max (2s interval)

        const poll = setInterval(async () => {
            attempts++;
            try {
                const response = await fetch('/api/videos');
                const data = await response.json();

                const videoExists = data.videos.some(v => v.filename === filename);

                if (videoExists) {
                    clearInterval(poll);
                    statusEl.textContent = 'Video generated successfully!';
                    setTimeout(() => {
                        modal.style.display = 'none';
                        this.loadVideos(); // Refresh list
                        this.showSuccess('Video generated successfully!');
                    }, 1000);
                } else if (attempts >= maxAttempts) {
                    clearInterval(poll);
                    statusEl.textContent = 'Generation timed out. Check logs.';
                    setTimeout(() => {
                        modal.style.display = 'none';
                        this.showError('Video generation timed out');
                    }, 2000);
                } else {
                    // Update status occasionally
                    if (attempts % 5 === 0) {
                        statusEl.textContent = `Processing... (${attempts * 2}s elapsed)`;
                    }
                }
            } catch (error) {
                console.error('Polling error:', error);
            }
        }, 2000);
    },

    async handleSaveResult() {
        const day = document.getElementById('resultDay').value;
        const username = document.getElementById('resultUser').value;
        const score = document.getElementById('resultScore').value;
        const isWinner = document.getElementById('resultWinner').checked;

        try {
            const response = await this.authorizedFetch('/api/admin/result', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day, username, score, isWinner })
            });

            if (response.ok) {
                this.showSuccess('Result saved successfully');
                this.closeModal();
                this.loadResults(day);
            } else {
                const data = await response.json();
                this.showError(data.error);
            }
        } catch (error) {
            this.showError('Failed to save result');
        }
    },

    async deleteResult(username) {
        if (!confirm(`Delete result for ${username} on Day ${this.currentDay}?`)) return;

        try {
            const response = await this.authorizedFetch('/api/admin/result', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ day: this.currentDay, username })
            });

            if (response.ok) {
                this.showSuccess('Result deleted');
                this.loadResults(this.currentDay);
            } else {
                this.showError('Failed to delete result');
            }
        } catch (error) {
            this.showError('Error deleting result');
        }
    },

    async deleteUser(id, username) {
        if (!confirm(`Delete user ${username} AND ALL their history? This cannot be undone.`)) return;

        try {
            const response = await this.authorizedFetch(`/api/admin/user/${id}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showSuccess('User deleted');
                this.loadUsers();
            } else {
                this.showError('Failed to delete user');
            }
        } catch (error) {
            this.showError('Error deleting user');
        }
    },

    // --- Existing Methods (Login, etc.) ---

    async handleLogin() {
        const password = document.getElementById('password').value;
        const errorEl = document.getElementById('loginError');

        try {
            const response = await fetch('/api/admin/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ password })
            });

            const data = await response.json();

            if (response.ok) {
                this.token = data.token;
                localStorage.setItem('adminToken', this.token);
                this.showDashboard();
                this.loadDashboardData();
            } else {
                errorEl.textContent = data.error || 'Invalid password';
                errorEl.style.display = 'block';
            }
        } catch (error) {
            errorEl.textContent = 'Login failed. Please try again.';
            errorEl.style.display = 'block';
        }
    },

    handleLogout() {
        this.token = null;
        localStorage.removeItem('adminToken');
        this.showLoginScreen();
    },

    showLoginScreen() {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('adminDashboard').style.display = 'none';
    },

    showDashboard() {
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('adminDashboard').style.display = 'block';
    },

    async loadDashboardData() {
        this.showLoading(true);
        try {
            await this.loadUsernames();
            await Promise.all([
                this.loadDatabaseInfo(),
                this.loadDaysList()
            ]);
        } catch (error) {
            this.showError('Failed to load dashboard data');
        } finally {
            this.showLoading(false);
        }
    },

    async loadDatabaseInfo() {
        try {
            const response = await this.authorizedFetch(`/api/admin/database-info?t=${Date.now()}`);
            const data = await response.json();
            this.renderDatabaseInfo(data);
        } catch (error) {
            console.error('Failed to load database info:', error);
        }
    },

    async loadDaysList() {
        try {
            const response = await this.authorizedFetch(`/api/admin/days?t=${Date.now()}`);
            const data = await response.json();
            this.renderDaysList(data.days);
        } catch (error) {
            console.error('Failed to load days list:', error);
        }
    },

    renderDatabaseInfo(data) {
        const container = document.getElementById('databaseInfo');

        let html = '<div class="info-grid">';
        html += `
            <div class="info-item">
                <span class="info-label">Total Days:</span>
                <span class="info-value">${data.total_days}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Total Users:</span>
                <span class="info-value">${data.overview.total_users}</span>
            </div>
            <div class="info-item">
                <span class="info-label">Total Entries:</span>
                <span class="info-value">${data.overview.total_entries}</span>
            </div>
        `;

        if (data.day_range) {
            html += `
                <div class="info-item">
                    <span class="info-label">Day Range:</span>
                    <span class="info-value">${data.day_range.min} - ${data.day_range.max}</span>
                </div>
            `;
        }

        html += '</div>';
        container.innerHTML = html;
    },

    renderDaysList(days) {
        const container = document.getElementById('daysList');

        if (!days || days.length === 0) {
            container.innerHTML = '<p style="color: #94a3b8;">No days in database</p>';
            return;
        }

        // Show recent days (last 20)
        const recentDays = days.slice(-20).reverse();

        let html = '<div style="max-height: 400px; overflow-y: auto;">';
        recentDays.forEach(item => {
            // Handle both old (number) and new (object) format
            const day = typeof item === 'object' ? item.day : item;
            let date = typeof item === 'object' ? item.date : null;

            // Fallback client-side calculation if date is missing
            if (!date) {
                date = this.getDateFromDay(day);
            }

            let dateStr = '';
            if (date) {
                const d = new Date(date);
                // Format: "Dec 22, 2025"
                const utcDate = new Date(d.getTime() + d.getTimezoneOffset() * 60000 + 12 * 60 * 60 * 1000);
                dateStr = `<span style="color: #94a3b8; font-weight: normal; margin-left: 0.5rem;">${utcDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>`;
            }

            html += `
                <div class="day-item">
                    <span><strong>Day ${day}</strong>${dateStr}</span>
                    <div style="display: flex; gap: 0.5rem;">
                        <button class="btn btn-secondary" onclick="AdminApp.viewDay(${day})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                            View
                        </button>
                        <button class="btn btn-danger" onclick="AdminApp.deleteDay(${day})" style="padding: 0.5rem 1rem; font-size: 0.875rem;">
                            Delete
                        </button>
                    </div>
                </div>
            `;
        });
        html += '</div>';

        if (days.length > 20) {
            html += `<p style="margin-top: 1rem; color: #94a3b8; font-size: 0.875rem;">Showing ${recentDays.length} most recent days of ${days.length} total</p>`;
        }

        container.innerHTML = html;
    },

    async viewDay(day) {
        // Switch to Data tab and select this day
        this.switchTab('data');
        const selector = document.getElementById('daySelector');
        selector.value = day;
        // Trigger change event manually
        selector.dispatchEvent(new Event('change'));
    },

    async deleteDay(day) {
        const confirm = window.confirm(`Are you sure you want to delete Day ${day}?\\nThis action cannot be undone.`);

        if (!confirm) return;

        this.showLoading(true);
        try {
            const response = await this.authorizedFetch(`/api/admin/day/${day}`, {
                method: 'DELETE'
            });

            if (response.ok) {
                this.showSuccess(`Day ${day} deleted successfully`);
                await this.loadDashboardData();
            } else {
                const data = await response.json();
                this.showError(data.error || 'Failed to delete day');
            }
        } catch (error) {
            this.showError('Failed to delete day');
        } finally {
            this.showLoading(false);
        }
    },

    async handleImport() {
        const message = document.getElementById('messageInput').value;
        const resultEl = document.getElementById('importResult');

        this.showLoading(true);
        try {
            const response = await this.authorizedFetch('/api/admin/import', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ message })
            });

            const data = await response.json();

            if (response.ok) {
                resultEl.innerHTML = `
                    <div class="success-message">
                        ✅ Successfully imported Day ${data.result.day} with ${data.result.results_added} entries<br>
                        Users: ${data.result.users_in_day.join(', ')}
                    </div>
                `;
                document.getElementById('messageInput').value = '';
                this.showSuccess('Data imported successfully');
                await this.loadDashboardData();
            } else {
                resultEl.innerHTML = `
                    <div class="error-message">
                        ❌ ${data.error}
                    </div>
                `;
            }
        } catch (error) {
            resultEl.innerHTML = `
                <div class="error-message">
                    ❌ Import failed: ${error.message}
                </div>
            `;
        } finally {
            this.showLoading(false);
        }
    },

    async handleGenerateVideo() {
        const type = document.getElementById('videoType').value;
        const filename = document.getElementById('videoFilename').value;
        const resultEl = document.getElementById('videoResult');

        resultEl.innerHTML = `
            <div class="success-message">
                ⏳ Generating video... This may take a few minutes.
            </div>
        `;

        try {
            const response = await this.authorizedFetch('/api/admin/video/generate', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ type, filename })
            });

            const data = await response.json();

            if (response.ok) {
                resultEl.innerHTML = `
                    <div class="success-message">
                        ✅ Video generated successfully!<br>
                        <a href="${data.url}" target="_blank" class="link">View Video</a>
                    </div>
                `;
                this.showSuccess('Video generated successfully');
            } else {
                resultEl.innerHTML = `
                    <div class="error-message">
                        ❌ ${data.error}<br>
                        ${data.details || ''}
                    </div>
                `;
            }
        } catch (error) {
            resultEl.innerHTML = `
                <div class="error-message">
                    ❌ Video generation failed: ${error.message}
                </div>
            `;
        }
    },

    async handleBackup() {
        try {
            const response = await this.authorizedFetch('/api/admin/backup');

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `wordle_backup_${new Date().toISOString().split('T')[0]}.db`;
                document.body.appendChild(a);
                a.click();
                window.URL.revokeObjectURL(url);
                document.body.removeChild(a);
                this.showSuccess('Backup downloaded successfully');
            } else {
                this.showError('Failed to create backup');
            }
        } catch (error) {
            this.showError('Failed to create backup');
        }
    },

    async handleClearDatabase() {
        const confirm1 = window.confirm('⚠️ WARNING: This will permanently delete ALL data!\\n\\nAre you absolutely sure?');
        if (!confirm1) return;

        const confirm2 = prompt('Type "DELETE ALL DATA" to confirm:');
        if (confirm2 !== 'DELETE ALL DATA') {
            this.showError('Database clear cancelled');
            return;
        }

        this.showLoading(true);
        try {
            const response = await this.authorizedFetch('/api/admin/clear', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ confirm: 'DELETE ALL DATA' })
            });

            if (response.ok) {
                this.showSuccess('Database cleared successfully');
                await this.loadDashboardData();
            } else {
                const data = await response.json();
                this.showError(data.error || 'Failed to clear database');
            }
        } catch (error) {
            this.showError('Failed to clear database');
        } finally {
            this.showLoading(false);
        }
    },

    authorizedFetch(url, options = {}) {
        return fetch(url, {
            ...options,
            headers: {
                ...options.headers,
                'Authorization': `Bearer ${this.token}`
            }
        });
    },

    showLoading(show) {
        document.getElementById('loadingSpinner').style.display = show ? 'flex' : 'none';
    },

    showSuccess(message) {
        const toast = document.getElementById('successToast');
        const messageEl = document.getElementById('successMessage');

        messageEl.textContent = message;
        toast.style.display = 'block';

        setTimeout(() => {
            toast.style.display = 'none';
        }, 5000);
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
        div.appendChild(document.createTextNode(String(text)));
        return div.innerHTML;
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});

