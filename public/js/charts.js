// Chart utilities for creating visualizations

const ChartUtils = {
    // Detect if user prefers dark mode
    isDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    },

    // Get theme-aware colors
    getThemeColors() {
        const isDark = this.isDarkMode();
        return {
            textColor: isDark ? '#f1f5f9' : '#0f172a',
            gridColor: isDark ? '#475569' : '#e2e8f0',
            bgColor: isDark ? '#1e293b' : '#ffffff',
            paperBgColor: isDark ? '#334155' : '#f8fafc',
            legendBgColor: isDark ? 'rgba(30, 41, 59, 0.9)' : 'rgba(255, 255, 255, 0.9)',
            borderColor: isDark ? '#475569' : '#cbd5e1'
        };
    },

    // Create Plotly chart for progress over time
    createPlotlyChart(elementId, data) {
        console.log('📊 createPlotlyChart called with:', elementId, data);
        console.log('📊 Plotly available:', typeof Plotly !== 'undefined');

        if (!data || !data.users || data.users.length === 0) {
            console.warn('⚠️ No chart data available');
            const textColor = this.getThemeColors().textColor;
            document.getElementById(elementId).innerHTML = `
                <div style="text-align: center; padding: 3rem; color: ${textColor};">
                    <p style="font-size: 3rem; margin-bottom: 1rem;">📈</p>
                    <p style="font-size: 1.25rem;">No data available for chart</p>
                </div>
            `;
            return;
        }

        const themeColors = this.getThemeColors();

        // Detect mobile device
        const isMobile = window.innerWidth < 768;

        const traces = data.users.map(user => ({
            x: user.data.map(d => d.x),
            y: user.data.map(d => d.y),
            mode: 'lines+markers',
            name: user.name,
            line: {
                color: user.color,
                width: isMobile ? 2 : 3,
                shape: 'spline',
                smoothing: 0.3
            },
            marker: {
                size: isMobile ? 5 : 8,
                color: user.color,
                line: {
                    color: themeColors.bgColor,
                    width: 2
                }
            },
            connectgaps: false,
            hovertemplate: '<b>%{fullData.name}</b><br>' +
                          'Day: %{x}<br>' +
                          'Score: %{y}/6<br>' +
                          '<extra></extra>'
        }));

        const layout = {
            title: {
                text: 'Score Progress Over Time',
                font: {
                    size: isMobile ? 16 : 20,
                    color: themeColors.textColor
                }
            },
            xaxis: {
                title: isMobile ? '' : 'Wordle Day',
                titlefont: { color: themeColors.textColor },
                tickfont: {
                    color: themeColors.textColor,
                    size: isMobile ? 10 : 12
                },
                gridcolor: themeColors.gridColor,
                showgrid: true,
                zerolinecolor: themeColors.gridColor
            },
            yaxis: {
                title: isMobile ? '' : 'Score (lower is better)',
                titlefont: { color: themeColors.textColor },
                tickfont: {
                    color: themeColors.textColor,
                    size: isMobile ? 10 : 12
                },
                gridcolor: themeColors.gridColor,
                showgrid: true,
                autorange: 'reversed',
                dtick: 1,
                zerolinecolor: themeColors.gridColor,
                range: [7, 0.5]
            },
            hovermode: 'x unified',
            hoverlabel: {
                bgcolor: themeColors.legendBgColor,
                bordercolor: themeColors.borderColor,
                font: {
                    size: isMobile ? 11 : 13,
                    color: themeColors.textColor
                }
            },
            showlegend: true,
            legend: {
                orientation: isMobile ? 'h' : 'v',
                x: isMobile ? 0 : 1,
                y: isMobile ? -0.2 : 1,
                xanchor: isMobile ? 'left' : 'left',
                yanchor: isMobile ? 'top' : 'top',
                bgcolor: themeColors.legendBgColor,
                bordercolor: themeColors.borderColor,
                borderwidth: 1,
                font: {
                    color: themeColors.textColor,
                    size: isMobile ? 9 : 12
                }
            },
            margin: {
                l: isMobile ? 40 : 60,
                r: isMobile ? 10 : 20,
                t: isMobile ? 40 : 60,
                b: isMobile ? 100 : 60
            },
            plot_bgcolor: themeColors.bgColor,
            paper_bgcolor: themeColors.paperBgColor,
            autosize: true
        };

        const config = {
            responsive: true,
            displayModeBar: !isMobile,
            displaylogo: false,
            modeBarButtonsToRemove: ['lasso2d', 'select2d', 'toImage'],
            scrollZoom: false,
            doubleClick: 'reset',
            toImageButtonOptions: {
                format: 'png',
                filename: 'wordle_progress',
                height: 800,
                width: 1200,
                scale: 2
            }
        };

        Plotly.newPlot(elementId, traces, layout, config);

        // Re-render chart when window resizes (responsive)
        if (!this._resizeListener) {
            this._resizeListener = this._debounce(() => {
                console.log('📐 Window resized, updating chart...');
                this.createPlotlyChart(elementId, data);
            }, 250);
            window.addEventListener('resize', this._resizeListener);
        }

        // Re-render chart when theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const handler = () => {
                console.log('🎨 Theme changed, updating chart...');
                this.createPlotlyChart(elementId, data);
            };

            // Remove old listener if exists
            if (this._themeListener) {
                mediaQuery.removeEventListener('change', this._themeListener);
            }

            // Add new listener
            this._themeListener = handler;
            mediaQuery.addEventListener('change', handler);
        }
    },

    // Debounce helper for resize events
    _debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Get medal emoji for top 3 positions
    getMedal(position) {
        const medals = {
            0: '🥇',
            1: '🥈',
            2: '🥉'
        };
        return medals[position] || (position + 1);
    },

    // Format score for display
    formatScore(score) {
        if (score === null || score === undefined) {
            return 'N/A';
        }
        if (typeof score === 'number') {
            return score.toFixed(2);
        }
        return score;
    },

    // Create a simple bar chart using Chart.js (if needed in the future)
    createBarChart(canvasId, labels, data, title) {
        const ctx = document.getElementById(canvasId).getContext('2d');

        return new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: title,
                    data: data,
                    backgroundColor: 'rgba(59, 130, 246, 0.5)',
                    borderColor: 'rgb(59, 130, 246)',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true
                    }
                }
            }
        });
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartUtils;
}
