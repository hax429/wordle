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

        if (!data || !data.users || data.users.length === 0) {
            this.showNoData(elementId);
            return;
        }

        const themeColors = this.getThemeColors();
        const isMobile = window.innerWidth < 768;

        const traces = data.users.map(user => ({
            x: user.data.map(d => d.x),
            y: user.data.map(d => d.y),
            // Map days to dates for hover
            text: user.data.map(d => {
                // Find index of day in the main days array to get corresponding date
                const index = data.days.indexOf(d.x);
                return index !== -1 && data.dates ? data.dates[index] : '';
            }),
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
                '%{text}<br>' +
                'Score: %{y}/6<br>' +
                '<extra></extra>'
        }));

        // Calculate default range (last 30 days)
        const allDays = data.users.flatMap(u => u.data.map(d => d.x));
        const maxDay = Math.max(...allDays);
        const minDay = Math.max(0, maxDay - 30);

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
                zerolinecolor: themeColors.gridColor,
                rangeslider: {
                    visible: true,
                    thickness: 0.1,
                    bgcolor: themeColors.bgColor,
                    bordercolor: themeColors.borderColor
                },
                rangemode: 'nonnegative',
                minallowed: 0,
                maxallowed: maxDay + 50,
                range: [minDay, maxDay + 1] // Default zoom
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
                range: [7, 0.5],
                fixedrange: true // Disable Y-axis zoom
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
                b: isMobile ? 60 : 60 // Adjusted for slider
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
            scrollZoom: true, // Enable scroll zoom for X-axis
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
        this.setupResizeListener(elementId, () => this.createPlotlyChart(elementId, data));
    },

    // Create Heatmap Chart
    createHeatmapChart(elementId, data) {
        console.log('📊 createHeatmapChart called');

        if (!data || !data.users || data.users.length === 0) {
            this.showNoData(elementId);
            return;
        }

        const themeColors = this.getThemeColors();
        const isMobile = window.innerWidth < 768;

        // Prepare data for heatmap
        // X: Days, Y: Users, Z: Scores
        const users = data.users.map(u => u.name);

        // Get all unique days and sort them
        const allDaysSet = new Set();
        data.users.forEach(u => u.data.forEach(d => allDaysSet.add(d.x)));
        const days = Array.from(allDaysSet).sort((a, b) => a - b);

        // Build Z matrix (scores)
        const zValues = [];
        const textValues = [];

        users.forEach(user => {
            const userObj = data.users.find(u => u.name === user);
            const row = [];
            const textRow = [];

            days.forEach((day, index) => {
                const entry = userObj.data.find(d => d.x === day);
                const date = data.dates ? data.dates[index] : '';
                const dateStr = date ? ` (${date})` : '';

                if (entry) {
                    row.push(entry.y);
                    textRow.push(`Score: ${entry.y}/6${dateStr}`);
                } else {
                    row.push(null); // No data
                    textRow.push(`No play${dateStr}`);
                }
            });
            zValues.push(row);
            textValues.push(textRow);
        });

        const trace = {
            x: days,
            y: users,
            z: zValues,
            text: textValues,
            type: 'heatmap',
            hoverongaps: false,
            hovertemplate: '<b>%{y}</b><br>Day %{x}<br>%{text}<extra></extra>',
            colorscale: [
                [0, '#518D4E'],   // 1 - Green
                [0.2, '#6AAA64'], // 2
                [0.4, '#B69F3A'], // 3 - Yellow
                [0.6, '#C9B458'], // 4
                [0.8, '#787C7E'], // 5 - Gray
                [1, '#3A3A3C']    // 6/X - Dark
            ],
            reversescale: false, // Lower is better, but our scale is manual
            showscale: true,
            colorbar: {
                title: 'Score',
                titleside: 'right',
                tickfont: { color: themeColors.textColor },
                titlefont: { color: themeColors.textColor }
            },
            xgap: 1,
            ygap: 1
        };

        // Default range (last 50 days)
        const maxDay = Math.max(...days);
        const minDay = Math.max(0, maxDay - 50);

        const layout = {
            title: {
                text: 'Performance Heatmap',
                font: {
                    size: isMobile ? 16 : 20,
                    color: themeColors.textColor
                }
            },
            xaxis: {
                title: 'Wordle Day',
                titlefont: { color: themeColors.textColor },
                tickfont: { color: themeColors.textColor },
                range: [minDay, maxDay + 1],
                rangemode: 'nonnegative',
                minallowed: 0,
                maxallowed: maxDay + 50,
                rangeslider: { visible: true } // Slider works for heatmap too!
            },
            yaxis: {
                titlefont: { color: themeColors.textColor },
                tickfont: { color: themeColors.textColor },
                automargin: true
            },
            margin: {
                l: 100, // Space for usernames
                r: 20,
                t: 60,
                b: 60
            },
            plot_bgcolor: themeColors.bgColor,
            paper_bgcolor: themeColors.paperBgColor
        };

        const config = {
            responsive: true,
            displayModeBar: !isMobile,
            displaylogo: false
        };

        Plotly.newPlot(elementId, [trace], layout, config);
        this.setupResizeListener(elementId, () => this.createHeatmapChart(elementId, data));
    },

    showNoData(elementId) {
        const textColor = this.getThemeColors().textColor;
        document.getElementById(elementId).innerHTML = `
            <div style="text-align: center; padding: 3rem; color: ${textColor};">
                <p style="font-size: 3rem; margin-bottom: 1rem;">📈</p>
                <p style="font-size: 1.25rem;">No data available for chart</p>
            </div>
        `;
    },

    setupResizeListener(elementId, callback) {
        if (!this._resizeListeners) this._resizeListeners = {};

        // Remove existing listener for this element
        if (this._resizeListeners[elementId]) {
            window.removeEventListener('resize', this._resizeListeners[elementId]);
        }

        // Create new debounced listener
        const listener = this._debounce(() => {
            console.log(`📐 Window resized, updating ${elementId}...`);
            callback();
        }, 250);

        this._resizeListeners[elementId] = listener;
        window.addEventListener('resize', listener);
    },

    // --- Helpers ---

    getMedal(index) {
        switch (index) {
            case 0: return '🥇';
            case 1: return '🥈';
            case 2: return '🥉';
            default: return '';
        }
    },

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
    }
};

// Export for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChartUtils;
}
