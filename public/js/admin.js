// Admin console JavaScript

const AdminApp = {
    token: null,

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
            const response = await this.authorizedFetch('/api/admin/database-info');
            const data = await response.json();
            this.renderDatabaseInfo(data);
        } catch (error) {
            console.error('Failed to load database info:', error);
        }
    },

    async loadDaysList() {
        try {
            const response = await this.authorizedFetch('/api/admin/days');
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
        recentDays.forEach(day => {
            html += `
                <div class="day-item">
                    <span><strong>Day ${day}</strong></span>
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
        try {
            const response = await this.authorizedFetch(`/api/admin/day/${day}`);
            const data = await response.json();
            
            let details = `Day ${day}\\nParticipants: ${data.participants}\\n\\n`;
            data.results.forEach(r => {
                const crown = r.is_winner ? '👑 ' : '';
                details += `${crown}${r.username}: ${r.score}/6\\n`;
            });
            
            alert(details);
        } catch (error) {
            this.showError(`Failed to load day ${day}`);
        }
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
    }
};

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    AdminApp.init();
});

