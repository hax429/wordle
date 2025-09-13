#!/usr/bin/env python3
import sqlite3
import statistics
from datetime import datetime, timedelta
from typing import Dict, List, Tuple, Optional
from collections import defaultdict
from flask import Flask, render_template, jsonify
import sys
import os

# Add utils to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.common import WordleCommon

app = Flask(__name__)

class WordleStatsCalculator:
    def __init__(self, db_file: str = None):
        self.db_file = db_file or WordleCommon.DEFAULT_DB_PATH

    def _get_connection(self):
        return WordleCommon.get_db_connection(self.db_file)

    def _score_to_numeric(self, score: str) -> int:
        """Convert score to numeric value, treating X as 7"""
        return WordleCommon.score_to_numeric(score)

    def get_all_time_stats(self) -> Dict:
        """Get comprehensive all-time statistics"""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Get basic user stats with numeric scores
        cursor.execute('''
            SELECT u.username, u.id, 
                   COUNT(r.id) as games_played,
                   GROUP_CONCAT(r.score) as all_scores
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id, u.username
            HAVING games_played > 0
            ORDER BY u.username
        ''')
        
        user_data = {}
        for row in cursor.fetchall():
            username, user_id, games_played, all_scores_str = row
            scores = all_scores_str.split(',') if all_scores_str else []
            numeric_scores = [self._score_to_numeric(s) for s in scores]
            
            user_data[username] = {
                'user_id': user_id,
                'games_played': games_played,
                'scores': scores,
                'numeric_scores': numeric_scores,
                'average_score': statistics.mean(numeric_scores) if numeric_scores else 0,
                'score_variance': statistics.variance(numeric_scores) if len(numeric_scores) > 1 else 0
            }

        # Get participation data
        cursor.execute('''
            SELECT u.username, 
                   COUNT(DISTINCT r.streak_day) as days_participated,
                   (SELECT COUNT(*) FROM streaks) as total_days
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id, u.username
            HAVING days_participated > 0
        ''')
        
        for row in cursor.fetchall():
            username, days_participated, total_days = row
            if username in user_data:
                user_data[username]['days_participated'] = days_participated
                user_data[username]['participation_rate'] = days_participated / total_days

        # Get streak data
        streak_data = self._calculate_streak_consistency(cursor)
        for username, streak_info in streak_data.items():
            if username in user_data:
                user_data[username].update(streak_info)

        conn.close()
        return user_data

    def get_last_week_stats(self) -> Dict:
        """Get statistics for the last 7 days"""
        conn = self._get_connection()
        cursor = conn.cursor()

        # Get the last 7 streak days
        cursor.execute('SELECT MAX(day) FROM streaks')
        max_day = cursor.fetchone()[0]
        if not max_day:
            return {}
        
        start_day = max(1, max_day - 6)  # Last 7 days

        cursor.execute('''
            SELECT u.username, u.id,
                   COUNT(r.id) as games_played,
                   GROUP_CONCAT(r.score) as all_scores
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            WHERE r.streak_day >= ? AND r.streak_day <= ?
            GROUP BY u.id, u.username
            HAVING games_played > 0
            ORDER BY u.username
        ''', (start_day, max_day))
        
        user_data = {}
        for row in cursor.fetchall():
            username, user_id, games_played, all_scores_str = row
            scores = all_scores_str.split(',') if all_scores_str else []
            numeric_scores = [self._score_to_numeric(s) for s in scores]
            
            user_data[username] = {
                'user_id': user_id,
                'games_played': games_played,
                'scores': scores,
                'numeric_scores': numeric_scores,
                'average_score': statistics.mean(numeric_scores) if numeric_scores else 0,
                'score_variance': statistics.variance(numeric_scores) if len(numeric_scores) > 1 else 0,
                'days_participated': games_played,  # Each game is one day in this period
                'participation_rate': games_played / 7.0
            }

        # Get streak data for last week
        streak_data = self._calculate_streak_consistency(cursor, start_day, max_day)
        for username, streak_info in streak_data.items():
            if username in user_data:
                user_data[username].update(streak_info)

        conn.close()
        return user_data

    def _calculate_streak_consistency(self, cursor, start_day: Optional[int] = None, end_day: Optional[int] = None) -> Dict:
        """Calculate streak consistency metrics"""
        date_filter = ""
        params = []
        if start_day and end_day:
            date_filter = "WHERE r.streak_day >= ? AND r.streak_day <= ?"
            params = [start_day, end_day]

        cursor.execute(f'''
            SELECT u.username,
                   GROUP_CONCAT(r.streak_day ORDER BY r.streak_day) as days
            FROM users u
            JOIN results r ON u.id = r.user_id
            {date_filter}
            GROUP BY u.id, u.username
        ''', params)
        
        streak_data = {}
        for row in cursor.fetchall():
            username, days_str = row
            if not days_str:
                continue
                
            days = [int(d) for d in days_str.split(',')]
            
            # Calculate longest streak
            longest_streak = self._find_longest_consecutive_streak(days)
            
            # Calculate consistency (inverse of gaps)
            gaps = []
            for i in range(1, len(days)):
                gap = days[i] - days[i-1]
                if gap > 1:
                    gaps.append(gap - 1)  # Subtract 1 because consecutive days have gap of 1
            
            avg_gap = statistics.mean(gaps) if gaps else 0
            consistency_score = 1 / (1 + avg_gap)  # Higher score = more consistent
            
            streak_data[username] = {
                'longest_streak': longest_streak,
                'consistency_score': consistency_score,
                'total_gaps': len(gaps),
                'average_gap': avg_gap
            }
        
        return streak_data

    def _find_longest_consecutive_streak(self, days: List[int]) -> int:
        """Find the longest consecutive streak in a list of days"""
        if not days:
            return 0
        
        max_streak = 1
        current_streak = 1
        
        for i in range(1, len(days)):
            if days[i] == days[i-1] + 1:
                current_streak += 1
                max_streak = max(max_streak, current_streak)
            else:
                current_streak = 1
                
        return max_streak

    def get_rankings(self, stats_data: Dict) -> Dict:
        """Generate rankings for all metrics"""
        if not stats_data:
            return {}
        
        # Filter users with sufficient data
        active_users = {k: v for k, v in stats_data.items() if v['games_played'] >= 3}
        
        rankings = {}
        
        # Average Score Ranking (lower is better)
        rankings['average_score'] = sorted(
            active_users.items(), 
            key=lambda x: x[1]['average_score']
        )
        
        # Participation Ranking (higher is better)
        rankings['participation'] = sorted(
            active_users.items(), 
            key=lambda x: x[1].get('days_participated', 0), 
            reverse=True
        )
        
        # Score Consistency Ranking (lower variance is better)
        rankings['score_consistency'] = sorted(
            active_users.items(), 
            key=lambda x: x[1]['score_variance']
        )
        
        # Streak Consistency Ranking (higher consistency score is better)
        users_with_streaks = {k: v for k, v in active_users.items() if 'consistency_score' in v}
        rankings['streak_consistency'] = sorted(
            users_with_streaks.items(), 
            key=lambda x: x[1]['consistency_score'], 
            reverse=True
        )
        
        # Longest Streak Ranking
        rankings['longest_streak'] = sorted(
            users_with_streaks.items(), 
            key=lambda x: x[1].get('longest_streak', 0), 
            reverse=True
        )
        
        return rankings

    def get_plot_data(self) -> Dict:
        """Get user score data over time for plotting"""
        conn = self._get_connection()
        cursor = conn.cursor()
        
        # Get all data ordered by day
        cursor.execute('''
            SELECT s.day, u.username, r.score
            FROM results r
            JOIN users u ON r.user_id = u.id
            JOIN streaks s ON r.streak_day = s.day
            ORDER BY s.day, u.username
        ''')
        
        # Organize data by user and day
        user_data = defaultdict(list)
        all_days = set()
        
        for day, username, score in cursor.fetchall():
            numeric_score = self._score_to_numeric(score)
            user_data[username].append({'day': day, 'score': numeric_score})
            all_days.add(day)
        
        conn.close()
        
        # Sort days and convert to list
        sorted_days = sorted(list(all_days))
        
        # Convert to format suitable for web plotting
        plot_data = {
            'days': sorted_days,
            'users': []
        }
        
        # Color palette for users
        colors = [
            '#FF4444', '#00FF88', '#4488FF', '#FFBB00', '#FF8844',
            '#BB44FF', '#00FFFF', '#FF44BB', '#88FF44', '#FF6600',
            '#0088FF', '#FF0088', '#AAFF00', '#8800FF', '#00FF44',
            '#FF2200', '#0044FF', '#FFAA44', '#FF4400', '#44AAFF'
        ]
        
        for i, (username, scores) in enumerate(user_data.items()):
            user_plot_data = {
                'name': username,
                'color': colors[i % len(colors)],
                'data': []
            }
            
            # Create a mapping for easy lookup
            score_map = {item['day']: item['score'] for item in scores}
            
            # Fill data for all days (None for days without scores)
            for day in sorted_days:
                if day in score_map:
                    user_plot_data['data'].append({'x': day, 'y': score_map[day]})
                else:
                    user_plot_data['data'].append({'x': day, 'y': None})
            
            plot_data['users'].append(user_plot_data)
        
        return plot_data

# Flask routes
stats_calculator = WordleStatsCalculator()

@app.route('/')
def index():
    return render_template('stats.html')

@app.route('/api/stats/all-time')
def api_all_time_stats():
    stats = stats_calculator.get_all_time_stats()
    rankings = stats_calculator.get_rankings(stats)
    return jsonify({
        'stats': stats,
        'rankings': rankings
    })

@app.route('/api/stats/last-week')
def api_last_week_stats():
    stats = stats_calculator.get_last_week_stats()
    rankings = stats_calculator.get_rankings(stats)
    return jsonify({
        'stats': stats,
        'rankings': rankings
    })

@app.route('/api/plot-data')
def api_plot_data():
    plot_data = stats_calculator.get_plot_data()
    return jsonify(plot_data)

@app.route('/plot')
def interactive_plot():
    return render_template('plot.html')

@app.route('/video')
def video_player():
    return render_template('video.html')

def export_comprehensive_html(output_file='../../exports/wordle_complete_export.html'):
    """Export complete website as a self-contained HTML file with stats, plot, and video"""
    import json
    import base64
    import os
    
    print("Creating comprehensive self-contained HTML export...")
    
    with app.app_context():
        # Gather all the stats data
        stats = stats_calculator.get_all_time_stats()
        rankings = stats_calculator.get_rankings(stats)
        weekly_stats = stats_calculator.get_last_week_stats()
        weekly_rankings = stats_calculator.get_rankings(weekly_stats)
        plot_data = stats_calculator.get_plot_data()
        
        all_time_data = {'stats': stats, 'rankings': rankings}
        last_week_data = {'stats': weekly_stats, 'rankings': weekly_rankings}
        
        # Encode video as base64
        video_base64 = ""
        video_path = "../../media/wordle_final_2d.mp4"
        if os.path.exists(video_path):
            print("Encoding video file...")
            with open(video_path, 'rb') as video_file:
                video_data = video_file.read()
                video_base64 = base64.b64encode(video_data).decode('utf-8')
            print(f"Video encoded ({len(video_base64)} characters)")
        else:
            print(f"Warning: Video file not found at {video_path}")
        
        # Create comprehensive HTML with all features
        html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Wordle Group Statistics - Complete Export</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <script src="https://cdn.plot.ly/plotly-2.27.0.min.js"></script>
    <script>
        tailwind.config = {{
            theme: {{
                extend: {{
                    colors: {{
                        'wordle-primary': '#667eea',
                        'wordle-secondary': '#764ba2',
                        'wordle-accent': '#ff6b6b',
                        'wordle-gold': '#fbbf24',
                        'wordle-emerald': '#10b981',
                        'wordle-rose': '#f43f5e'
                    }},
                    animation: {{
                        'float': 'float 3s ease-in-out infinite',
                        'glow': 'glow 2s ease-in-out infinite alternate',
                        'slideIn': 'slideIn 0.5s ease-out',
                        'fadeIn': 'fadeIn 0.6s ease-out'
                    }},
                    keyframes: {{
                        float: {{
                            '0%, 100%': {{ transform: 'translateY(0px)' }},
                            '50%': {{ transform: 'translateY(-10px)' }}
                        }},
                        glow: {{
                            '0%': {{ boxShadow: '0 0 20px rgba(102, 126, 234, 0.3)' }},
                            '100%': {{ boxShadow: '0 0 30px rgba(102, 126, 234, 0.6)' }}
                        }},
                        slideIn: {{
                            '0%': {{ transform: 'translateX(-100%)', opacity: '0' }},
                            '100%': {{ transform: 'translateX(0)', opacity: '1' }}
                        }},
                        fadeIn: {{
                            '0%': {{ opacity: '0', transform: 'translateY(20px)' }},
                            '100%': {{ opacity: '1', transform: 'translateY(0)' }}
                        }}
                    }},
                    backgroundImage: {{
                        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
                        'mesh-gradient': 'radial-gradient(circle at 20% 80%, rgba(120, 119, 198, 0.3) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255, 107, 107, 0.3) 0%, transparent 50%), radial-gradient(circle at 40% 40%, rgba(16, 185, 129, 0.3) 0%, transparent 50%)'
                    }}
                }}
            }}
        }}
    </script>
    <style>
        /* Theme Variables */
        :root {{
            --bg-primary: #f8fafc;
            --bg-secondary: #ffffff;
            --bg-accent: linear-gradient(135deg, #667eea, #764ba2);
            --text-primary: #1f2937;
            --text-secondary: #6b7280;
            --text-accent: #667eea;
            --border-color: rgba(255, 255, 255, 0.2);
            --glass-bg: rgba(255, 255, 255, 0.9);
            --card-shadow: 0 25px 50px rgba(0,0,0,0.15);
        }}
        
        [data-theme="dark"] {{
            --bg-primary: #0f172a;
            --bg-secondary: #1e293b;
            --bg-accent: linear-gradient(135deg, #4f46e5, #7c3aed);
            --text-primary: #f1f5f9;
            --text-secondary: #94a3b8;
            --text-accent: #8b5cf6;
            --border-color: rgba(148, 163, 184, 0.2);
            --glass-bg: rgba(30, 41, 59, 0.8);
            --card-shadow: 0 25px 50px rgba(0,0,0,0.4);
        }}

        body {{
            background: var(--bg-primary);
            color: var(--text-primary);
            transition: all 0.3s ease;
        }}

        .theme-toggle {{
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 100;
            background: var(--glass-bg);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
            border-radius: 50px;
            padding: 8px;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: var(--card-shadow);
        }}

        .theme-toggle:hover {{
            transform: scale(1.05);
        }}

        .podium-container {{
            background: linear-gradient(135deg, #ff6b6b, #ffa726, #ab47bc);
            min-height: 400px;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding: 40px 20px;
            position: relative;
            overflow: hidden;
        }}

        .podium-item {{
            display: flex;
            flex-direction: column;
            align-items: center;
            margin: 0 15px;
            transition: all 0.3s ease;
        }}

        .podium-item:hover {{
            transform: translateY(-10px);
        }}

        .podium-rank {{
            width: 60px;
            height: 60px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: bold;
            color: white;
            margin-bottom: 10px;
            box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        }}

        .rank-1 {{ background: linear-gradient(135deg, #ffd700, #ffed4a); }}
        .rank-2 {{ background: linear-gradient(135deg, #c0c0c0, #e2e8f0); }}
        .rank-3 {{ background: linear-gradient(135deg, #cd7f32, #f6ad55); }}

        .podium-card {{
            background: var(--bg-secondary);
            border-radius: 20px;
            padding: 20px;
            min-width: 200px;
            text-align: center;
            box-shadow: var(--card-shadow);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
        }}

        .podium-pillar {{
            width: 100%;
            margin-top: 20px;
            border-radius: 10px 10px 0 0;
            transition: all 0.3s ease;
        }}

        .pillar-1 {{ height: 120px; background: linear-gradient(to top, #ffd700, #ffed4a); }}
        .pillar-2 {{ height: 80px; background: linear-gradient(to top, #c0c0c0, #e2e8f0); }}
        .pillar-3 {{ height: 100px; background: linear-gradient(to top, #cd7f32, #f6ad55); }}

        .tab-content {{ 
            display: none; 
            animation: fadeIn 0.5s ease-out;
        }}
        .tab-content.active {{ 
            display: block; 
        }}
        .tab-button {{
            position: relative;
            overflow: hidden;
            transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
            background: var(--glass-bg);
            color: var(--text-primary);
            backdrop-filter: blur(16px);
            border: 1px solid var(--border-color);
        }}
        .tab-button::before {{
            content: '';
            position: absolute;
            top: 0;
            left: -100%;
            width: 100%;
            height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
            transition: left 0.5s ease;
        }}
        .tab-button:hover::before {{
            left: 100%;
        }}
        .tab-button.active {{
            background: var(--bg-accent);
            color: white;
            box-shadow: 0 10px 25px rgba(102, 126, 234, 0.3);
        }}
        .tab-button:hover {{
            transform: translateY(-2px);
            box-shadow: 0 8px 25px rgba(0,0,0,0.1);
        }}
        #plot {{ 
            width: 100%; 
            height: 650px; 
            border-radius: 12px;
            overflow: hidden;
        }}
        
        /* Mobile Responsiveness */
        @media (max-width: 768px) {{
            .container {{ padding: 0 1rem; }}
            .header {{ padding: 2rem 0; }}
            .header h1 {{ font-size: 2.5rem; }}
            .header p {{ font-size: 1rem; }}
            .podium-container {{ padding: 20px 10px; min-height: 300px; }}
            .podium-item {{ margin: 0 8px; }}
            .podium-rank {{ width: 50px; height: 50px; font-size: 20px; }}
            .podium-card {{ min-width: 150px; padding: 15px; }}
            .pillar-1 {{ height: 80px; }}
            .pillar-2 {{ height: 60px; }}
            .pillar-3 {{ height: 70px; }}
            .tab-button {{ padding: 0.75rem 1rem; font-size: 0.9rem; }}
            .stat-card {{ padding: 1.5rem; }}
            .glass-card {{ padding: 1rem; }}
            #plot {{ height: 450px; }}
        }}
        
        @media (max-width: 480px) {{
            .header h1 {{ font-size: 2rem; }}
            .podium-container {{ padding: 15px 5px; min-height: 250px; }}
            .podium-item {{ margin: 0 4px; }}
            .podium-rank {{ width: 40px; height: 40px; font-size: 16px; }}
            .podium-card {{ min-width: 120px; padding: 10px; }}
            .tab-button {{ padding: 0.5rem 0.75rem; font-size: 0.8rem; }}
            .stat-card {{ padding: 1rem; }}
            #plot {{ height: 350px; }}
            #quickStats {{ grid-template-columns: repeat(2, 1fr); }}
            #quickStats .text-lg {{ font-size: 1rem; }}
        }}
        .glass-card {{
            backdrop-filter: blur(16px);
            background: var(--glass-bg);
            border: 1px solid var(--border-color);
        }}
        .gradient-text {{
            background: var(--bg-accent);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
            background-clip: text;
        }}
        .stat-card {{
            background: var(--glass-bg);
            backdrop-filter: blur(20px);
            border: 1px solid var(--border-color);
            transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }}
        .stat-card:hover {{
            transform: translateY(-8px) scale(1.02);
            box-shadow: var(--card-shadow);
        }}
        .floating-shapes {{
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            overflow: hidden;
            pointer-events: none;
        }}
        .shape {{
            position: absolute;
            background: linear-gradient(45deg, rgba(102, 126, 234, 0.1), rgba(255, 107, 107, 0.1));
            border-radius: 50%;
            animation: float 6s ease-in-out infinite;
        }}
        .shape:nth-child(1) {{ width: 80px; height: 80px; top: 10%; left: 10%; animation-delay: 0s; }}
        .shape:nth-child(2) {{ width: 120px; height: 120px; top: 70%; right: 10%; animation-delay: -2s; }}
        .shape:nth-child(3) {{ width: 60px; height: 60px; top: 40%; left: 80%; animation-delay: -4s; }}
        
        @media (prefers-reduced-motion: reduce) {{
            *, *::before, *::after {{
                animation-duration: 0.01ms !important;
                animation-iteration-count: 1 !important;
                transition-duration: 0.01ms !important;
            }}
        }}
    </style>
</head>
<body class="min-h-screen relative overflow-x-hidden" style="background: var(--bg-primary);">
    <!-- Theme Toggle -->
    <div class="theme-toggle" onclick="toggleTheme()">
        <div class="flex items-center space-x-2 px-4 py-2">
            <span id="themeIcon" class="text-2xl">🌙</span>
            <span id="themeText" class="font-medium" style="color: var(--text-primary);">Dark</span>
        </div>
    </div>

    <!-- Floating Background Shapes -->
    <div class="floating-shapes">
        <div class="shape"></div>
        <div class="shape"></div>
        <div class="shape"></div>
    </div>
    
    <div class="relative z-10">
        <!-- Enhanced Header with Glass Effect -->
        <header class="relative bg-gradient-to-r from-wordle-accent via-purple-600 to-pink-500 text-white py-12 overflow-hidden">
            <div class="absolute inset-0 bg-mesh-gradient opacity-20"></div>
            
            <div class="relative container mx-auto px-6 text-center">
                <div class="inline-block animate-float mb-4">
                    <div class="text-5xl mb-2">🎯</div>
                </div>
                <h1 class="text-5xl font-extrabold mb-3 drop-shadow-lg">
                    Wordle Group Statistics
                </h1>
                <p class="text-lg opacity-90 mb-6">Track your group's performance and see who's dominating the word game!</p>
                
                <!-- Navigation Buttons -->
                <div class="flex flex-wrap justify-center gap-3 mb-6">
                    <button onclick="showTab('stats')" class="inline-flex items-center px-4 py-2 bg-white/90 text-gray-800 backdrop-blur-sm rounded-lg border border-white/50 hover:bg-white hover:shadow-lg transition-all font-semibold shadow-md">
                        <span class="text-xl mr-2">📊</span>
                        <span class="text-sm md:text-base">Statistics</span>
                    </button>
                    <button onclick="showTab('plot')" class="inline-flex items-center px-4 py-2 bg-white/90 text-gray-800 backdrop-blur-sm rounded-lg border border-white/50 hover:bg-white hover:shadow-lg transition-all font-semibold shadow-md">
                        <span class="text-xl mr-2">📈</span>
                        <span class="text-sm md:text-base">Interactive Plot</span>
                    </button>
                    <button onclick="showTab('video')" class="inline-flex items-center px-4 py-2 bg-white/90 text-gray-800 backdrop-blur-sm rounded-lg border border-white/50 hover:bg-white hover:shadow-lg transition-all font-semibold shadow-md">
                        <span class="text-xl mr-2">🎬</span>
                        <span class="text-sm md:text-base">Progress Video</span>
                    </button>
                </div>
                
                <div class="inline-flex items-center space-x-3 bg-black/20 backdrop-blur-sm rounded-full px-4 py-2">
                    <div class="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                    <span class="text-sm">Generated {json.dumps(str(__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M:%S')))}</span>
                </div>
            </div>
        </header>

        <!-- Enhanced Navigation with Glass Effect -->
        <nav class="sticky top-0 z-50 glass-card shadow-xl border-b border-white/20">
            <div class="container mx-auto px-6">
                <div class="flex justify-center space-x-2 py-4">
                    <button onclick="showTab('stats')" class="tab-button active px-8 py-4 font-bold rounded-xl transition-all text-lg shadow-lg" id="stats-tab">
                        <span class="flex items-center space-x-2">
                            <span class="text-2xl">📊</span>
                            <span>Statistics</span>
                        </span>
                    </button>
                    <button onclick="showTab('plot')" class="tab-button px-8 py-4 font-bold rounded-xl transition-all bg-white/50 hover:bg-white/70 text-lg shadow-lg" id="plot-tab">
                        <span class="flex items-center space-x-2">
                            <span class="text-2xl">📈</span>
                            <span>Interactive Plot</span>
                        </span>
                    </button>
                    <button onclick="showTab('video')" class="tab-button px-8 py-4 font-bold rounded-xl transition-all bg-white/50 hover:bg-white/70 text-lg shadow-lg" id="video-tab">
                        <span class="flex items-center space-x-2">
                            <span class="text-2xl">🎬</span>
                            <span>Progress Video</span>
                        </span>
                    </button>
                </div>
            </div>
        </nav>

        <!-- Tab Contents -->
        <div class="container mx-auto px-6 py-12">
            
            <!-- Stats Tab -->
            <div id="stats-content" class="tab-content active">
                <!-- Time Period Selector -->
                <div class="mb-12 flex justify-center">
                    <div class="glass-card rounded-2xl p-2 shadow-2xl">
                        <div class="flex space-x-2">
                            <button id="allTimeBtn" class="px-8 py-4 bg-gradient-to-r from-wordle-primary to-wordle-secondary text-white rounded-xl font-bold shadow-lg transition-all duration-300 hover:shadow-xl hover:scale-105" onclick="showAllTime()">
                                <span class="flex items-center space-x-2">
                                    <span>🏆</span>
                                    <span>All Time Champions</span>
                                </span>
                            </button>
                            <button id="lastWeekBtn" class="px-8 py-4 bg-white/70 text-gray-700 rounded-xl font-bold shadow-lg transition-all duration-300 hover:bg-white hover:shadow-xl hover:scale-105" onclick="showLastWeek()">
                                <span class="flex items-center space-x-2">
                                    <span>📅</span>
                                    <span>Last 7 Days</span>
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
                
                <!-- Enhanced Stats Container -->
                <div id="statsContainer" class="grid gap-8 max-w-7xl mx-auto">
                    <!-- Stats will be rendered here with beautiful cards -->
                </div>
            </div>

            <!-- Enhanced Plot Tab -->
            <div id="plot-content" class="tab-content">
                <div class="glass-card rounded-3xl shadow-2xl p-8 max-w-7xl mx-auto">
                    <!-- Plot Header -->
                    <div class="text-center mb-8">
                        <div class="inline-block animate-float mb-4">
                            <span class="text-5xl">📈</span>
                        </div>
                        <h2 class="text-4xl font-bold gradient-text mb-4">Interactive Progress Plot</h2>
                        <p class="text-xl text-gray-600 max-w-2xl mx-auto">Navigate through your Wordle data with an elegant sliding window visualization</p>
                    </div>
                    
                    <!-- Enhanced Plot Controls -->
                    <div class="mb-8 glass-card rounded-2xl p-6 shadow-lg">
                        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
                            <div class="space-y-4">
                                <label class="block text-base md:text-lg font-bold text-gray-800 mb-3 flex items-center">
                                    <span class="text-xl md:text-2xl mr-2">📅</span>
                                    <span class="text-sm md:text-base">Current Day Navigation</span>
                                </label>
                                <input type="range" id="daySlider" min="1" max="100" value="5" class="w-full h-3 bg-gradient-to-r from-wordle-primary to-wordle-secondary rounded-lg appearance-none cursor-pointer slider">
                                <div class="flex justify-between text-sm text-gray-500">
                                    <span>Day 1</span>
                                    <span class="text-lg md:text-2xl font-bold text-wordle-primary" id="dayValue">Day 5</span>
                                    <span>Day 100</span>
                                </div>
                            </div>
                            <div class="space-y-4">
                                <label class="block text-base md:text-lg font-bold text-gray-800 mb-3 flex items-center">
                                    <span class="text-xl md:text-2xl mr-2">🔍</span>
                                    <span class="text-sm md:text-base">Window Size Control</span>
                                </label>
                                <input type="range" id="windowSlider" min="3" max="10" value="5" class="w-full h-3 bg-gradient-to-r from-wordle-accent to-orange-400 rounded-lg appearance-none cursor-pointer slider">
                                <div class="flex justify-between text-sm text-gray-500">
                                    <span>3 days</span>
                                    <span class="text-lg md:text-2xl font-bold text-wordle-accent" id="windowValue">5 days</span>
                                    <span>10 days</span>
                                </div>
                            </div>
                        </div>
                        <div class="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200">
                            <p class="text-center text-gray-700 font-medium flex items-center justify-center flex-wrap gap-2 text-sm md:text-base">
                                <span class="flex items-center"><span class="text-lg md:text-xl mr-1">🖱️</span><span class="hidden sm:inline">Scroll on plot</span><span class="sm:hidden">Scroll</span></span>
                                <span class="w-2 h-2 bg-gray-300 rounded-full"></span>
                                <span class="flex items-center"><span class="text-lg md:text-xl mr-1">🎛️</span><span class="hidden sm:inline">Use sliders</span><span class="sm:hidden">Sliders</span></span>
                                <span class="w-2 h-2 bg-gray-300 rounded-full"></span>
                                <span class="flex items-center"><span class="text-lg md:text-xl mr-1">⬆️</span><span class="hidden sm:inline">Higher = Better</span><span class="sm:hidden">Higher ↑</span></span>
                            </p>
                        </div>
                    </div>
                    
                    <!-- Enhanced Plot Container -->
                    <div class="relative overflow-hidden rounded-2xl shadow-2xl border-4 border-white/50">
                        <div class="absolute inset-0 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900"></div>
                        <div id="plot" class="relative z-10 bg-transparent"></div>
                    </div>
                </div>
            </div>

            <!-- Enhanced Video Tab -->
            <div id="video-content" class="tab-content">
                <div class="glass-card rounded-3xl shadow-2xl overflow-hidden max-w-7xl mx-auto">
                    <!-- Video Header -->
                    <div class="relative bg-gradient-to-r from-wordle-accent via-pink-500 to-orange-500 p-12 overflow-hidden">
                        <div class="absolute inset-0 bg-mesh-gradient opacity-20"></div>
                        <div class="relative text-center">
                            <div class="inline-block animate-float mb-4">
                                <span class="text-6xl">🎬</span>
                            </div>
                            <h2 class="text-4xl font-bold text-white mb-4">Progress Video Experience</h2>
                            <p class="text-xl text-white/90 max-w-2xl mx-auto">Watch your group's Wordle journey unfold in this cinematic animated visualization</p>
                        </div>
                    </div>
                    
                    <div class="p-6">
                        <!-- Enhanced Video Player -->
                        <div class="relative mb-6">
                            <div class="relative w-full glass-card rounded-xl overflow-hidden shadow-xl border-2 border-white/30" style="padding-bottom: 56.25%; /* 16:9 aspect ratio */">
                                {'<video id="wordleVideo" class="absolute top-0 left-0 w-full h-full object-contain bg-gray-100" controls preload="metadata" poster="data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTI4MCIgaGVpZ2h0PSI3MjAiIHZpZXdCb3g9IjAgMCAxMjgwIDcyMCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGRlZnM+CjxsaW5lYXJHcmFkaWVudCBpZD0iZ3JhZGllbnQiIHgxPSIwJSIgeTE9IjAlIiB4Mj0iMTAwJSIgeTI9IjEwMCUiPgo8c3RvcCBvZmZzZXQ9IjAlIiBzdG9wLWNvbG9yPSIjNjY3ZWVhIi8+CjxzdG9wIG9mZnNldD0iMTAwJSIgc3RvcC1jb2xvcj0iIzc2NGJhMiIvPgo8L2xpbmVhckdyYWRpZW50Pgo8L2RlZnM+CjxyZWN0IHdpZHRoPSIxMjgwIiBoZWlnaHQ9IjcyMCIgZmlsbD0idXJsKCNncmFkaWVudCkiLz4KPGV0ZXh0IHg9IjY0MCIgeT0iMzMwIiBmaWxsPSJ3aGl0ZSIgZm9udC1zaXplPSI0OCIgZm9udC1mYW1pbHk9IkFyaWFsLCBzYW5zLXNlcmlmIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBkeT0iMC4zZW0iPldvcmRsZSBQcm9ncmVzcyBWaWRlbzwvdGV4dD4KPHN2ZyB4PSI2MTAiIHk9IjM4MCIgd2lkdGg9IjYwIiBoZWlnaHQ9IjYwIiBmaWxsPSJ3aGl0ZSIgb3BhY2l0eT0iMC45Ij4KPHBhdGggZD0ibTcuNSAwIDIwIDEwLTIwIDEweiIvPgo8L3N2Zz4KPC9zdmc+"><source src="data:video/mp4;base64,' + video_base64 + '" type="video/mp4"><div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-wordle-primary to-wordle-secondary"><div class="text-center text-white"><div class="text-6xl mb-6 animate-pulse">🎬</div><p class="text-2xl font-bold mb-2">Video Experience</p><p class="text-lg opacity-80">Ready to play</p></div></div></video>' if video_base64 else '<div class="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200"><div class="text-center text-gray-600"><div class="text-6xl mb-6">🎬</div><p class="text-2xl font-bold mb-2">Video Not Available</p><p class="text-lg">Original video file was not found</p></div></div>'}
                            </div>
                        </div>
                        
                        <!-- Enhanced Feature Cards -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            <div class="stat-card rounded-xl p-4 shadow-lg bg-white/95 backdrop-blur-sm">
                                <div class="flex items-center mb-4">
                                    <div class="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center text-lg text-white shadow-md">✨</div>
                                    <h3 class="text-lg font-bold text-gray-800 ml-3">Video Features</h3>
                                </div>
                                <ul class="space-y-2 text-sm">
                                    <li class="flex items-center text-gray-700">
                                        <div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                        <span class="font-medium">Cinematic timeline progression with smooth transitions</span>
                                    </li>
                                    <li class="flex items-center text-gray-700">
                                        <div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                        <span class="font-medium">Dynamic sliding window (5-6 days) for optimal viewing</span>
                                    </li>
                                    <li class="flex items-center text-gray-700">
                                        <div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                        <span class="font-medium">Premium dark theme with elegant styling</span>
                                    </li>
                                    <li class="flex items-center text-gray-700">
                                        <div class="w-4 h-4 bg-green-500 rounded-full flex items-center justify-center mr-2">
                                            <svg class="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path fill-rule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clip-rule="evenodd"></path>
                                            </svg>
                                        </div>
                                        <span class="font-medium">Vibrant color-coded user identification system</span>
                                    </li>
                                </ul>
                            </div>
                            
                            <div class="stat-card rounded-xl p-4 shadow-lg bg-white/95 backdrop-blur-sm">
                                <div class="flex items-center mb-4">
                                    <div class="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center text-lg text-white shadow-md">🎯</div>
                                    <h3 class="text-lg font-bold text-gray-800 ml-3">Performance Guide</h3>
                                </div>
                                <ul class="space-y-2">
                                    <li class="flex items-center justify-between p-2 bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg border border-green-200">
                                        <div class="flex items-center">
                                            <span class="w-3 h-3 bg-gradient-to-br from-green-400 to-green-600 rounded-full mr-2"></span>
                                            <span class="font-semibold text-gray-800 text-sm">Score 1 (Perfect)</span>
                                        </div>
                                        <span class="px-2 py-1 bg-green-500 text-white rounded-full text-xs font-bold">🏆 Champion</span>
                                    </li>
                                    <li class="flex items-center justify-between p-2 bg-gradient-to-r from-blue-50 to-cyan-50 rounded-lg border border-blue-200">
                                        <div class="flex items-center">
                                            <span class="w-3 h-3 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full mr-2"></span>
                                            <span class="font-semibold text-gray-800 text-sm">Scores 2-3</span>
                                        </div>
                                        <span class="px-2 py-1 bg-blue-500 text-white rounded-full text-xs font-bold">⭐ Excellent</span>
                                    </li>
                                    <li class="flex items-center justify-between p-2 bg-gradient-to-r from-yellow-50 to-orange-50 rounded-lg border border-yellow-200">
                                        <div class="flex items-center">
                                            <span class="w-3 h-3 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full mr-2"></span>
                                            <span class="font-semibold text-gray-800 text-sm">Scores 4-5</span>
                                        </div>
                                        <span class="px-2 py-1 bg-yellow-500 text-white rounded-full text-xs font-bold">👍 Good</span>
                                    </li>
                                    <li class="flex items-center justify-between p-2 bg-gradient-to-r from-red-50 to-pink-50 rounded-lg border border-red-200">
                                        <div class="flex items-center">
                                            <span class="w-3 h-3 bg-gradient-to-br from-red-400 to-pink-500 rounded-full mr-2"></span>
                                            <span class="font-semibold text-gray-800 text-sm">Score 6 or X</span>
                                        </div>
                                        <span class="px-2 py-1 bg-red-500 text-white rounded-full text-xs font-bold">💪 Tough Day</span>
                                    </li>
                                </ul>
                            </div>
                        </div>
                        
                        <!-- Stats Summary Cards -->
                        <div class="mt-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3" id="quickStats">
                            <!-- Quick stats will be populated by JavaScript -->
                        </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Embedded data
        const allTimeData = {json.dumps(all_time_data, indent=8)};
        const lastWeekData = {json.dumps(last_week_data, indent=8)};
        const plotData = {json.dumps(plot_data, indent=8)};
        
        let currentView = 'all-time';
        let currentDay = 5;
        let windowSize = 5;
        let totalDays = plotData.days ? plotData.days.length : 100;

        // Tab switching
        function showTab(tabName) {{
            // Hide all tabs
            document.querySelectorAll('.tab-content').forEach(content => {{
                content.classList.remove('active');
            }});
            document.querySelectorAll('.tab-button').forEach(btn => {{
                btn.classList.remove('active');
                btn.classList.add('bg-gray-100');
            }});
            
            // Show selected tab
            document.getElementById(tabName + '-content').classList.add('active');
            document.getElementById(tabName + '-tab').classList.add('active');
            document.getElementById(tabName + '-tab').classList.remove('bg-gray-100');
            
            // Initialize plot if plot tab is selected
            if (tabName === 'plot' && plotData && plotData.days) {{
                setTimeout(initializePlot, 100);
            }}
            
            // Update quick stats if video tab is selected
            if (tabName === 'video') {{
                updateQuickStats();
            }}
        }}

        // Update quick stats for video tab
        function updateQuickStats() {{
            const statsContainer = document.getElementById('quickStats');
            if (!statsContainer || !allTimeData.rankings) return;

            // Get top performers for each metric
            const topAverage = allTimeData.rankings.average_score?.[0] || null;
            const topParticipation = allTimeData.rankings.participation?.[0] || null;
            const topConsistency = allTimeData.rankings.score_consistency?.[0] || null;
            const topStreak = allTimeData.rankings.streak_consistency?.[0] || null;
            const topLongestStreak = allTimeData.rankings.longest_streak?.[0] || null;

            const statsHtml = `
                <div class="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-white/50">
                    <div class="text-xs font-medium text-gray-600 mb-1">🏆 Best Average</div>
                    <div class="text-lg font-bold text-blue-600">${{topAverage ? topAverage[1].average_score.toFixed(2) : 'N/A'}}</div>
                    <div class="text-xs text-gray-500">${{topAverage ? topAverage[0] : 'No data'}}</div>
                </div>
                <div class="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-white/50">
                    <div class="text-xs font-medium text-gray-600 mb-1">📅 Most Active</div>
                    <div class="text-lg font-bold text-green-600">${{topParticipation ? topParticipation[1].days_participated : 'N/A'}}</div>
                    <div class="text-xs text-gray-500">${{topParticipation ? topParticipation[0] : 'No data'}}</div>
                </div>
                <div class="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-white/50">
                    <div class="text-xs font-medium text-gray-600 mb-1">🎯 Most Consistent</div>
                    <div class="text-lg font-bold text-purple-600">${{topConsistency ? (topConsistency[1].score_variance < 0.01 ? '0.00' : topConsistency[1].score_variance.toFixed(2)) : 'N/A'}}</div>
                    <div class="text-xs text-gray-500">${{topConsistency ? topConsistency[0] : 'No data'}}</div>
                </div>
                <div class="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-white/50">
                    <div class="text-xs font-medium text-gray-600 mb-1">🔥 Best Streak</div>
                    <div class="text-lg font-bold text-orange-600">${{topLongestStreak ? topLongestStreak[1].longest_streak : 'N/A'}}</div>
                    <div class="text-xs text-gray-500">${{topLongestStreak ? topLongestStreak[0] : 'No data'}}</div>
                </div>
                <div class="bg-white/90 backdrop-blur-sm rounded-lg p-3 shadow-md border border-white/50">
                    <div class="text-xs font-medium text-gray-600 mb-1">📊 Total Games</div>
                    <div class="text-lg font-bold text-gray-700">${{Object.values(allTimeData.stats).reduce((total, user) => total + user.games_played, 0)}}</div>
                    <div class="text-xs text-gray-500">All players</div>
                </div>
            `;
            
            statsContainer.innerHTML = statsHtml;
        }}

        // Stats functions
        function showAllTime() {{
            currentView = 'all-time';
            document.getElementById('allTimeBtn').classList.add('bg-wordle-primary', 'text-white');
            document.getElementById('allTimeBtn').classList.remove('bg-gray-200', 'text-gray-700');
            document.getElementById('lastWeekBtn').classList.remove('bg-wordle-primary', 'text-white');
            document.getElementById('lastWeekBtn').classList.add('bg-gray-200', 'text-gray-700');
            renderStats(allTimeData);
        }}

        function showLastWeek() {{
            currentView = 'last-week';
            document.getElementById('lastWeekBtn').classList.add('bg-wordle-primary', 'text-white');
            document.getElementById('lastWeekBtn').classList.remove('bg-gray-200', 'text-gray-700');
            document.getElementById('allTimeBtn').classList.remove('bg-wordle-primary', 'text-white');
            document.getElementById('allTimeBtn').classList.add('bg-gray-200', 'text-gray-700');
            renderStats(lastWeekData);
        }}

        function renderStats(data) {{
            const container = document.getElementById('statsContainer');
            if (!data.stats || Object.keys(data.stats).length === 0) {{
                container.innerHTML = '<div class="text-center text-gray-500 py-16"><div class="text-6xl mb-4">📊</div><p class="text-2xl font-bold">No data available</p></div>';
                return;
            }}

            let html = '';
            
            // Average Score Rankings - Enhanced Design
            if (data.rankings.average_score) {{
                html += `<div class="stat-card rounded-3xl shadow-2xl p-8 overflow-hidden relative">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-blue-400/20 to-purple-500/20 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative">
                        <div class="flex items-center mb-8">
                            <div class="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg mr-4">🎯</div>
                            <div>
                                <h3 class="text-3xl font-bold gradient-text">Champion Leaderboard</h3>
                                <p class="text-gray-600 font-medium">Average Score Rankings (Lower = Better)</p>
                            </div>
                        </div>
                        <div class="space-y-4">`;
                
                data.rankings.average_score.slice(0, 8).forEach((item, index) => {{
                    const [username, stats] = item;
                    const medalColors = ['from-yellow-400 to-yellow-600', 'from-gray-300 to-gray-500', 'from-orange-400 to-orange-600'];
                    const bgColor = index < 3 ? 'bg-gradient-to-r from-white to-gray-50 border-l-4 border-yellow-400' : 'bg-white/70';
                    const medal = index < 3 ? ['🥇', '🥈', '🥉'][index] : `${{index + 1}}`;
                    
                    html += `<div class="flex items-center justify-between p-6 ${{bgColor}} rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-gradient-to-br ${{index < 3 ? medalColors[index] : 'from-blue-400 to-blue-600'}} text-white rounded-xl flex items-center justify-center text-lg font-bold mr-4 shadow-lg">
                                ${{typeof medal === 'string' && medal.includes('🎖') ? medal : (index < 3 ? medal : index + 1)}}
                            </div>
                            <div>
                                <span class="font-bold text-xl text-gray-800">${{username}}</span>
                                <div class="text-sm text-gray-500 font-medium">${{stats.games_played}} games played</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">${{stats.average_score.toFixed(2)}}</div>
                            <div class="text-sm text-gray-500 font-medium">avg score</div>
                        </div>
                    </div>`;
                }});
                html += '</div></div></div>';
            }}

            // Participation Rankings - Enhanced Design
            if (data.rankings.participation) {{
                html += `<div class="stat-card rounded-3xl shadow-2xl p-8 overflow-hidden relative">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-green-400/20 to-emerald-500/20 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative">
                        <div class="flex items-center mb-8">
                            <div class="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg mr-4">📅</div>
                            <div>
                                <h3 class="text-3xl font-bold gradient-text">Most Active Players</h3>
                                <p class="text-gray-600 font-medium">Participation & Consistency Champions</p>
                            </div>
                        </div>
                        <div class="space-y-4">`;
                
                data.rankings.participation.slice(0, 8).forEach((item, index) => {{
                    const [username, stats] = item;
                    const participationRate = ((stats.participation_rate || 0) * 100).toFixed(1);
                    const bgColor = index < 3 ? 'bg-gradient-to-r from-white to-green-50 border-l-4 border-green-400' : 'bg-white/70';
                    
                    html += `<div class="flex items-center justify-between p-6 ${{bgColor}} rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-[1.02]">
                        <div class="flex items-center">
                            <div class="w-12 h-12 bg-gradient-to-br from-green-400 to-emerald-600 text-white rounded-xl flex items-center justify-center text-lg font-bold mr-4 shadow-lg">
                                ${{index + 1}}
                            </div>
                            <div>
                                <span class="font-bold text-xl text-gray-800">${{username}}</span>
                                <div class="text-sm text-gray-500 font-medium">${{participationRate}}% participation rate</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-3xl font-bold bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">${{stats.days_participated || 0}}</div>
                            <div class="text-sm text-gray-500 font-medium">days active</div>
                        </div>
                    </div>`;
                }});
                html += '</div></div></div>';
            }}

            // Add Streak Consistency if available
            if (data.rankings.streak_consistency && data.rankings.streak_consistency.length > 0) {{
                html += `<div class="stat-card rounded-3xl shadow-2xl p-8 overflow-hidden relative md:col-span-2">
                    <div class="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-400/20 to-pink-500/20 rounded-full -mr-16 -mt-16"></div>
                    <div class="relative">
                        <div class="flex items-center mb-8">
                            <div class="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl flex items-center justify-center text-3xl text-white shadow-lg mr-4">🔥</div>
                            <div>
                                <h3 class="text-3xl font-bold gradient-text">Streak Masters</h3>
                                <p class="text-gray-600 font-medium">Consistency & Streak Champions</p>
                            </div>
                        </div>
                        <div class="grid md:grid-cols-2 gap-4">`;
                
                data.rankings.streak_consistency.slice(0, 6).forEach((item, index) => {{
                    const [username, stats] = item;
                    const consistencyPercent = ((stats.consistency_score || 0) * 100).toFixed(1);
                    
                    html += `<div class="flex items-center justify-between p-4 bg-white/70 rounded-xl shadow-md hover:shadow-lg transition-all duration-300">
                        <div class="flex items-center">
                            <div class="w-10 h-10 bg-gradient-to-br from-purple-400 to-pink-600 text-white rounded-lg flex items-center justify-center text-sm font-bold mr-3">
                                ${{index + 1}}
                            </div>
                            <div>
                                <span class="font-semibold text-gray-800">${{username}}</span>
                                <div class="text-xs text-gray-500">${{consistencyPercent}}% consistent</div>
                            </div>
                        </div>
                        <div class="text-right">
                            <div class="text-lg font-bold text-purple-600">${{stats.longest_streak || 0}}</div>
                            <div class="text-xs text-gray-500">best streak</div>
                        </div>
                    </div>`;
                }});
                html += '</div></div></div>';
            }}

            container.innerHTML = html;
        }}

        // Plot functions
        function initializePlot() {{
            if (!plotData || !plotData.days || plotData.days.length === 0) {{
                document.getElementById('plot').innerHTML = '<div class="flex items-center justify-center h-full text-gray-500">No plot data available</div>';
                return;
            }}
            
            totalDays = plotData.days.length;
            currentDay = Math.min(windowSize, totalDays);
            
            document.getElementById('daySlider').max = totalDays;
            document.getElementById('daySlider').value = currentDay;
            
            updatePlot();
        }}

        function updatePlot() {{
            if (!plotData) return;

            const halfWindow = Math.floor(windowSize / 2);
            let windowStart = Math.max(0, currentDay - halfWindow - 1);
            let windowEnd = Math.min(plotData.days.length - 1, windowStart + windowSize - 1);
            
            if (windowEnd - windowStart + 1 < windowSize) {{
                if (windowEnd === plotData.days.length - 1) {{
                    windowStart = Math.max(0, windowEnd - windowSize + 1);
                }}
            }}

            const windowDays = plotData.days.slice(windowStart, windowEnd + 1);
            
            const traces = plotData.users.map(user => {{
                const allValidData = user.data.filter(d => d.y !== null && d.y !== undefined);
                const windowValidData = allValidData.filter(d => 
                    d.x >= windowDays[0] && d.x <= windowDays[windowDays.length - 1]
                );
                
                return {{
                    x: windowValidData.map(d => d.x),
                    y: windowValidData.map(d => d.y),
                    type: 'scatter',
                    mode: 'markers+lines',
                    name: user.name,
                    line: {{ color: user.color, width: 3 }},
                    marker: {{ color: user.color, size: 10, line: {{ color: 'white', width: 2 }} }},
                    connectgaps: true
                }};
            }}).filter(trace => trace.x.length > 0);

            const layout = {{
                title: {{
                    text: `Wordle Progress - Day ${{currentDay}} (${{((currentDay / totalDays) * 100).toFixed(0)}}%)`,
                    font: {{ size: 18, color: 'white' }}
                }},
                xaxis: {{
                    title: 'Day',
                    range: [windowDays[0] - 0.5, windowDays[windowDays.length - 1] + 0.5],
                    color: 'white',
                    gridcolor: '#333',
                    tickfont: {{ color: 'white' }}
                }},
                yaxis: {{
                    title: 'Score (Lower = Better)',
                    range: [7.5, 0.5],
                    tickmode: 'array',
                    tickvals: [1, 2, 3, 4, 5, 6, 7],
                    ticktext: ['1 (Perfect!)', '2', '3', '4', '5', '6', 'X (Failed)'],
                    color: 'white',
                    gridcolor: '#333',
                    tickfont: {{ color: 'white' }}
                }},
                paper_bgcolor: '#111827',
                plot_bgcolor: '#111827',
                font: {{ color: 'white' }},
                legend: {{ bgcolor: 'rgba(26, 26, 26, 0.9)', bordercolor: '#666', font: {{ color: 'white' }} }}
            }};

            Plotly.newPlot('plot', traces, layout, {{ responsive: true }});

            document.getElementById('dayValue').textContent = `Day ${{currentDay}}`;
            
            // Add scroll event listener
            document.getElementById('plot').addEventListener('wheel', function(event) {{
                event.preventDefault();
                const delta = event.deltaY > 0 ? 2 : -2;
                currentDay = Math.max(1, Math.min(totalDays, currentDay + delta));
                document.getElementById('daySlider').value = currentDay;
                updatePlot();
            }});
        }}

        // Theme toggle functionality
        function toggleTheme() {{
            const body = document.body;
            const themeIcon = document.getElementById('themeIcon');
            const themeText = document.getElementById('themeText');
            
            if (body.hasAttribute('data-theme')) {{
                // Switch to light theme
                body.removeAttribute('data-theme');
                themeIcon.textContent = '🌙';
                themeText.textContent = 'Dark';
                localStorage.setItem('theme', 'light');
            }} else {{
                // Switch to dark theme
                body.setAttribute('data-theme', 'dark');
                themeIcon.textContent = '☀️';
                themeText.textContent = 'Light';
                localStorage.setItem('theme', 'dark');
            }}
        }}

        // Initialize theme from localStorage
        function initializeTheme() {{
            const savedTheme = localStorage.getItem('theme');
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            
            if (savedTheme === 'dark' || (!savedTheme && prefersDark)) {{
                document.body.setAttribute('data-theme', 'dark');
                document.getElementById('themeIcon').textContent = '☀️';
                document.getElementById('themeText').textContent = 'Light';
            }} else {{
                document.body.removeAttribute('data-theme');
                document.getElementById('themeIcon').textContent = '🌙';
                document.getElementById('themeText').textContent = 'Dark';
            }}
        }}

        // Event listeners
        document.addEventListener('DOMContentLoaded', function() {{
            // Initialize theme
            initializeTheme();
            
            // Initialize stats
            renderStats(allTimeData);
            
            // Setup plot controls
            if (plotData && plotData.days) {{
                totalDays = plotData.days.length;
                document.getElementById('daySlider').max = totalDays;
                
                document.getElementById('daySlider').addEventListener('input', function(e) {{
                    currentDay = parseInt(e.target.value);
                    updatePlot();
                }});
                
                document.getElementById('windowSlider').addEventListener('input', function(e) {{
                    windowSize = parseInt(e.target.value);
                    document.getElementById('windowValue').textContent = windowSize + ' days';
                    updatePlot();
                }});
            }}
        }});
    </script>
</body>
</html>"""
        
        # Write the comprehensive HTML file
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(html_content)
        
        file_size_mb = os.path.getsize(output_file) / (1024 * 1024)
        print(f"✅ Comprehensive export created: {output_file}")
        print(f"📊 File size: {file_size_mb:.1f} MB")
        print(f"📈 Includes: Stats, Interactive Plot, {'Video' if video_base64 else 'Video (not found)'}")
        print(f"🚀 Ready to copy to any computer and open directly in browser!")
        
        return True

def export_stats_to_html(output_file='../../exports/wordle_stats_export.html'):
    """Legacy export function - use export_comprehensive_html instead"""
    return export_comprehensive_html(output_file)

if __name__ == '__main__':
    import sys
    if len(sys.argv) > 1 and sys.argv[1] == '--export':
        # If --export flag is provided, export the comprehensive HTML
        output_file = sys.argv[2] if len(sys.argv) > 2 else '../../exports/wordle_complete_export.html'
        export_comprehensive_html(output_file)
    elif len(sys.argv) > 1 and sys.argv[1] == '--export-simple':
        # Simple stats-only export (legacy)
        output_file = sys.argv[2] if len(sys.argv) > 2 else '../../exports/wordle_stats_export.html'
        export_stats_to_html(output_file)
    else:
        # Otherwise run the Flask app as usual
        app.run(debug=True, port=12001)