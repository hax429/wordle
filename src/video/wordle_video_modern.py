#!/usr/bin/env python3
import sqlite3
import matplotlib.pyplot as plt
import matplotlib.animation as animation
from mpl_toolkits.mplot3d import Axes3D
import numpy as np
from collections import defaultdict
import random
from typing import Dict, List, Tuple
import colorsys
import matplotlib.font_manager as fm
import sys
import os

# Add utils to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.common import WordleCommon

class ModernWordleVideoGenerator:
    def __init__(self, db_file: str = None):
        self.db_file = db_file or WordleCommon.DEFAULT_DB_PATH
        
        # High-contrast, distinct color palette optimized for dark backgrounds
        self.modern_colors = [
            '#FF4444',  # Bright Red
            '#00FF88',  # Bright Green  
            '#4488FF',  # Bright Blue
            '#FFBB00',  # Golden Yellow
            '#FF8844',  # Orange
            '#BB44FF',  # Purple
            '#00FFFF',  # Cyan
            '#FF44BB',  # Magenta
            '#88FF44',  # Lime Green
            '#FF6600',  # Deep Orange
            '#0088FF',  # Sky Blue
            '#FF0088',  # Hot Pink
            '#AAFF00',  # Yellow-Green
            '#8800FF',  # Violet
            '#00FF44',  # Spring Green
            '#FF2200',  # Red-Orange
            '#0044FF',  # Royal Blue
            '#FFAA44',  # Light Orange
            '#FF4400',  # Vermillion
            '#44AAFF'   # Light Blue
        ]
        
    def _score_to_numeric(self, score: str) -> int:
        """Convert score to numeric value, treating X as 7"""
        return WordleCommon.score_to_numeric(score)
    
    def get_user_data_over_time(self) -> Dict:
        """Extract user score data over time"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Get all data ordered by day
        cursor.execute('''
            SELECT s.day, u.username, r.score
            FROM results r
            JOIN users u ON r.user_id = u.id
            JOIN streaks s ON r.streak_day = s.day
            ORDER BY s.day, u.username
        ''')
        
        # Organize data by user
        user_data = defaultdict(list)
        all_days = set()
        
        for day, username, score in cursor.fetchall():
            numeric_score = self._score_to_numeric(score)
            user_data[username].append((day, numeric_score))
            all_days.add(day)
        
        conn.close()
        
        # Sort days and convert to list
        sorted_days = sorted(list(all_days))
        
        # Convert to day-indexed format for easier animation
        day_data = {}
        for day in sorted_days:
            day_data[day] = {}
            for username, scores in user_data.items():
                # Find score for this specific day
                day_score = None
                for score_day, score in scores:
                    if score_day == day:
                        day_score = score
                        break
                day_data[day][username] = day_score
        
        return {
            'day_data': day_data,
            'sorted_days': sorted_days,
            'all_users': list(user_data.keys())
        }
    
    def create_modern_3d_animation(self, output_filename: str = "../../media/wordle_modern_3d.mp4", 
                                   fps: int = 4, duration_per_day: float = 0.4):
        """Create elegant 3D animated visualization with sliding window"""
        
        print("Creating elegant 3D visualization...")
        data = self.get_user_data_over_time()
        
        if not data['sorted_days']:
            print("No data found in database!")
            return False
        
        day_data = data['day_data']
        sorted_days = data['sorted_days']
        all_users = data['all_users']
        
        print(f"Processing {len(all_users)} users across {len(sorted_days)} days")
        
        # Setup the figure with dark theme
        plt.style.use('dark_background')
        fig = plt.figure(figsize=(16, 10))
        ax = fig.add_subplot(111, projection='3d')
        
        # Elegant styling
        fig.patch.set_facecolor('#0a0a0a')
        ax.xaxis.pane.fill = False
        ax.yaxis.pane.fill = False
        ax.zaxis.pane.fill = False
        
        # Subtle grid styling
        ax.xaxis.pane.set_edgecolor('#222222')
        ax.yaxis.pane.set_edgecolor('#222222')
        ax.zaxis.pane.set_edgecolor('#222222')
        ax.grid(True, alpha=0.2, color='#333333')
        
        # Window settings for sliding view
        window_size = 5
        
        # Initial setup - will be updated in animation
        ax.set_ylim(0.5, 7.5)
        ax.invert_yaxis()  # Flip Y-axis so 1 is at top (higher is better)
        ax.set_zlim(-2, 2)  # Elegant depth range for spatial feeling
        
        ax.set_xlabel('Day', fontsize=14, color='white', labelpad=10)
        ax.set_ylabel('Score (Higher is Better)', fontsize=14, color='white', labelpad=10)
        ax.set_zlabel('Depth', fontsize=14, color='white', labelpad=10)
        
        # Set Y-axis ticks and labels
        ax.set_yticks([1, 2, 3, 4, 5, 6, 7])
        ax.set_yticklabels(['1', '2', '3', '4', '5', '6', 'X'], color='white')
        
        # Color each user elegantly
        user_colors = {}
        for i, user in enumerate(all_users):
            user_colors[user] = self.modern_colors[i % len(self.modern_colors)]
        
        # Initialize 3D line objects for each user (all at Z=0 for elegance)
        lines_3d = {}
        scatter_3d = {}
        for user in all_users:
            line, = ax.plot([], [], [], linewidth=4, 
                           color=user_colors[user], label=user, 
                           alpha=0.9, linestyle='-', solid_capstyle='round')
            lines_3d[user] = line
            
            # Add elegant scatter points
            scatter = ax.scatter([], [], [], s=80, 
                               color=user_colors[user], alpha=1.0,
                               edgecolors='white', linewidth=2)
            scatter_3d[user] = scatter
        
        # Title and styling
        title = ax.text2D(0.5, 0.95, '', transform=ax.transAxes, 
                         fontsize=18, ha='center', va='top', color='white',
                         weight='bold')
        
        # Add elegant legend
        ax.legend(loc='upper left', bbox_to_anchor=(0, 1), fontsize=10,
                 frameon=True, facecolor='#1a1a1a', edgecolor='#444444')
        
        # Animation function with sliding window
        def animate(frame):
            current_day_idx = frame
            if current_day_idx >= len(sorted_days):
                return []
            
            current_day = sorted_days[current_day_idx]
            
            # Calculate sliding window
            if current_day_idx < window_size - 1:
                # Early days - show from day 1
                window_start = 0
                window_end = window_size - 1
            else:
                # Sliding window - center on current day
                center_offset = window_size // 2
                window_start = current_day_idx - center_offset
                window_end = current_day_idx + center_offset
            
            # Ensure we don't go beyond bounds
            window_start = max(0, window_start)
            window_end = min(len(sorted_days) - 1, window_end)
            
            # Update X-axis limits for sliding window
            start_day = sorted_days[window_start]
            end_day = sorted_days[window_end]
            ax.set_xlim(start_day - 0.5, end_day + 0.5)
            
            # Update title with progress
            progress = (current_day_idx + 1) / len(sorted_days) * 100
            title.set_text(f'Wordle Progress 3D - Day {current_day} ({progress:.0f}%)')
            
            # Update each user's 3D line and scatter
            objects_to_return = []
            
            for user in all_users:
                x_data = []
                y_data = []
                z_data = []
                
                # Collect data within the sliding window
                for day_idx in range(max(0, window_start), min(current_day_idx + 1, window_end + 1)):
                    day = sorted_days[day_idx]
                    if user in day_data[day] and day_data[day][user] is not None:
                        x_data.append(day)
                        y_data.append(day_data[day][user])
                        # Add subtle Z variation for 3D effect without clutter
                        z_offset = np.sin(day * 0.1) * 0.3  # Gentle wave effect
                        z_data.append(z_offset)
                
                # Update line
                lines_3d[user].set_data_3d(x_data, y_data, z_data)
                objects_to_return.append(lines_3d[user])
                
                # Update scatter points
                if x_data:
                    scatter_3d[user]._offsets3d = (x_data, y_data, z_data)
                    objects_to_return.append(scatter_3d[user])
            
            # Elegant rotation - slower and more subtle
            rotation_speed = 0.2
            elevation = 25 + 10 * np.sin(frame * 0.05)  # Gentle elevation change
            ax.view_init(elev=elevation, azim=frame * rotation_speed)
            
            return objects_to_return
        
        # Create animation
        print(f"Creating 3D animation with {len(sorted_days)} frames...")
        anim = animation.FuncAnimation(fig, animate, frames=len(sorted_days), 
                                     interval=int(duration_per_day * 1000), 
                                     blit=False, repeat=True)
        
        # Save animation
        print(f"Saving 3D animation as {output_filename}...")
        try:
            if output_filename.endswith('.mp4'):
                anim.save(output_filename, writer='ffmpeg', fps=fps, 
                         extra_args=['-vcodec', 'libx264', '-pix_fmt', 'yuv420p'])
                print(f"Modern 3D MP4 saved as {output_filename}")
            else:
                # Save as GIF
                gif_filename = output_filename.replace('.mp4', '.gif')
                anim.save(gif_filename, writer='pillow', fps=fps)
                print(f"Modern 3D GIF saved as {gif_filename}")
        except Exception as e:
            print(f"Error saving animation: {e}")
            return False
        
        plt.close()
        return True
    
    def create_modern_2d_animation(self, output_filename: str = "../../media/wordle_modern_2d.mp4", 
                                   fps: int = 3, duration_per_day: float = 1.5):
        """Create modern 2D animated visualization with sliding window (5-6 days visible)"""
        
        print("Creating modern 2D sliding window visualization...")
        data = self.get_user_data_over_time()
        
        if not data['sorted_days']:
            print("No data found!")
            return False
        
        day_data = data['day_data']
        sorted_days = data['sorted_days']
        all_users = data['all_users']
        
        # Set up font for emoji support
        try:
            available_fonts = [font.name for font in fm.fontManager.ttflist]
            emoji_fonts = ['Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', 'DejaVu Sans']
            
            selected_font = None
            for font in emoji_fonts:
                if font in available_fonts:
                    selected_font = font
                    break
            
            if selected_font:
                plt.rcParams['font.family'] = selected_font
                print(f"Using font: {selected_font}")
        except Exception as e:
            print(f"Font setup warning: {e}")
            plt.rcParams['font.family'] = 'DejaVu Sans'
        
        print(f"Data prepared: {len(sorted_days)} days x {len(all_users)} users")
        
        # Setup figure with dark theme and optimal size
        plt.style.use('dark_background')
        fig, ax = plt.subplots(figsize=(18, 12))
        fig.patch.set_facecolor('#0a0a0a')
        ax.set_facecolor('#0f0f0f')
        
        # Assign unique colors to each user
        user_colors = {}
        for i, user in enumerate(all_users):
            user_colors[user] = self.modern_colors[i % len(self.modern_colors)]
        
        # Window settings for sliding view
        window_size = 6  # Show 6 days at a time for clean visualization
        
        # Y-axis setup (inverted for better = higher)
        ax.set_ylim(0.5, 7.5)
        ax.invert_yaxis()
        ax.set_yticks([1, 2, 3, 4, 5, 6, 7])
        ax.set_yticklabels(['1 (Perfect!)', '2', '3', '4', '5', '6', 'X (Failed)'], 
                          fontsize=16, color='white', weight='bold')
        
        # Enhanced styling
        ax.set_xlabel('Day', fontsize=20, color='white', weight='bold')
        ax.set_ylabel('Score', fontsize=20, color='white', weight='bold')
        ax.grid(True, alpha=0.3, color='#555555', linewidth=1.2)
        
        # Style the spines
        for spine in ax.spines.values():
            spine.set_color('#888888')
            spine.set_linewidth(2)
        
        ax.tick_params(colors='white', labelsize=14, width=1.5)
        
        # Initialize line objects with enhanced styling
        lines = {}
        scatters = {}
        for user in all_users:
            line, = ax.plot([], [], linewidth=4, color=user_colors[user], 
                           label=user, alpha=0.9, solid_capstyle='round',
                           marker='o', markersize=8, markeredgewidth=2, 
                           markeredgecolor='white')
            lines[user] = line
            
            # Add enhanced scatter points
            scatter = ax.scatter([], [], s=120, color=user_colors[user], 
                               alpha=1.0, edgecolors='white', linewidth=3,
                               zorder=5)
            scatters[user] = scatter
        
        # Enhanced title
        title = ax.text(0.5, 0.96, '', transform=ax.transAxes, 
                       fontsize=24, ha='center', va='top', color='white',
                       weight='bold')
        
        # Enhanced legend positioned outside plot area
        legend = ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left', 
                          fontsize=16, frameon=True, facecolor='#1a1a1a', 
                          edgecolor='#666666', labelcolor='white',
                          borderpad=1, columnspacing=1, handlelength=2)
        
        for text in legend.get_texts():
            text.set_weight('bold')
        
        # Add performance guide - positioned to avoid blocking content
        ax.text(0.02, 0.78, 
               'Performance Guide:\n• Higher on chart = Better\n• 1 = Perfect game\n• X = Failed to guess', 
               transform=ax.transAxes, fontsize=12, color='#CCCCCC',
               verticalalignment='top', weight='bold',
               bbox=dict(boxstyle='round,pad=0.6', facecolor='#1a1a1a', 
                        edgecolor='#666666', alpha=0.9, linewidth=1.5))
        
        plt.tight_layout()
        
        # Initialize line label texts
        line_labels = {}
        for user in all_users:
            label_text = ax.text(0, 0, user, fontsize=12, color=user_colors[user], 
                               weight='bold', ha='left', va='center',
                               bbox=dict(boxstyle='round,pad=0.3', facecolor='black', 
                                        edgecolor=user_colors[user], alpha=0.8, linewidth=2))
            line_labels[user] = label_text
        
        # Enhanced animation function with smooth sliding window and line labels
        def animate(frame):
            current_day_idx = frame
            if current_day_idx >= len(sorted_days):
                return []
            
            current_day = sorted_days[current_day_idx]
            
            # Calculate sliding window (show 6 days)
            if current_day_idx < window_size - 1:
                # Early days - show from day 1
                window_start_idx = 0
                window_end_idx = min(window_size - 1, len(sorted_days) - 1)
            else:
                # Sliding window - center around current day
                center_offset = window_size // 2
                window_start_idx = max(0, current_day_idx - center_offset)
                window_end_idx = min(len(sorted_days) - 1, current_day_idx + center_offset)
            
            # Set X-axis limits for sliding window with padding
            start_day = sorted_days[window_start_idx]
            end_day = sorted_days[window_end_idx]
            ax.set_xlim(start_day - 0.7, end_day + 0.7)
            
            # Update title with progress and current day info
            progress = (current_day_idx + 1) / len(sorted_days) * 100
            title.set_text(f'Wordle Progress - Day {current_day} ({progress:.0f}%) - Higher = Better!')
            
            # Clear previous labels to avoid overlap
            for label in line_labels.values():
                label.set_position((0, 0))
                label.set_text('')
            
            # Track label positions to avoid overlap
            used_positions = set()
            
            # Update each user's line and scatter within the window
            for user in all_users:
                x_data = []
                y_data = []
                
                # Collect data within the current window, up to current day
                for day_idx in range(window_start_idx, min(current_day_idx + 1, window_end_idx + 1)):
                    day = sorted_days[day_idx]
                    if user in day_data[day] and day_data[day][user] is not None:
                        x_data.append(day)
                        y_data.append(day_data[day][user])
                
                # Update line with smooth curve
                lines[user].set_data(x_data, y_data)
                
                # Update scatter points with enhanced visibility
                if x_data:
                    scatters[user].set_offsets(np.column_stack([x_data, y_data]))
                    scatters[user].set_sizes([140] * len(x_data))
                    
                    # Add line label at the end of the line (avoid overlapping)
                    last_x, last_y = x_data[-1], y_data[-1]
                    
                    # Find a good position for the label that doesn't overlap
                    label_x = last_x + 0.1
                    label_y = last_y
                    
                    # Adjust position to avoid overlap with other labels
                    attempts = 0
                    while (round(label_y, 1) in used_positions) and attempts < 5:
                        label_y += 0.2 if attempts % 2 == 0 else -0.2
                        attempts += 1
                    
                    # Only show label if it's within reasonable bounds
                    if 0.5 <= label_y <= 7.5:
                        used_positions.add(round(label_y, 1))
                        line_labels[user].set_position((label_x, label_y))
                        line_labels[user].set_text(user)
                    
                else:
                    scatters[user].set_offsets(np.empty((0, 2)))
            
            return (list(lines.values()) + list(scatters.values()) + 
                   list(line_labels.values()) + [title])
        
        # Create animation
        print(f"Creating sliding window animation with {len(sorted_days)} frames...")
        anim = animation.FuncAnimation(fig, animate, frames=len(sorted_days), 
                                     interval=int(duration_per_day * 1000), 
                                     blit=False, repeat=True)
        
        # Save animation
        print(f"Saving sliding window animation as {output_filename}...")
        try:
            if output_filename.endswith('.mp4'):
                anim.save(output_filename, writer='ffmpeg', fps=fps, 
                         extra_args=['-vcodec', 'libx264', '-pix_fmt', 'yuv420p'])
                print(f"Sliding Window 2D MP4 saved as {output_filename}")
            else:
                gif_filename = output_filename.replace('.mp4', '.gif')
                anim.save(gif_filename, writer='pillow', fps=fps)
                print(f"Sliding Window 2D GIF saved as {gif_filename}")
        except Exception as e:
            print(f"Error saving animation: {e}")
            return False
        
        plt.close()
        return True
    
    def create_interactive_plot(self, window_size: int = 5):
        """Create interactive scrollable plot with sliding window navigation"""
        
        print("Creating interactive scrollable visualization...")
        data = self.get_user_data_over_time()
        
        if not data['sorted_days']:
            print("No data found!")
            return False
        
        day_data = data['day_data']
        sorted_days = data['sorted_days']
        all_users = data['all_users']
        
        print(f"Data prepared: {len(sorted_days)} days x {len(all_users)} users")
        
        # Setup figure with dark theme and optimal size
        plt.style.use('dark_background')
        fig, ax = plt.subplots(figsize=(16, 10))
        fig.patch.set_facecolor('#0a0a0a')
        ax.set_facecolor('#0f0f0f')
        
        # Assign unique colors to each user
        user_colors = {}
        for i, user in enumerate(all_users):
            user_colors[user] = self.modern_colors[i % len(self.modern_colors)]
        
        # Y-axis setup (inverted for better = higher)
        ax.set_ylim(0.5, 7.5)
        ax.invert_yaxis()
        ax.set_yticks([1, 2, 3, 4, 5, 6, 7])
        ax.set_yticklabels(['1 (Perfect!)', '2', '3', '4', '5', '6', 'X (Failed)'], 
                          fontsize=14, color='white', weight='bold')
        
        # Enhanced styling
        ax.set_xlabel('Day', fontsize=16, color='white', weight='bold')
        ax.set_ylabel('Score', fontsize=16, color='white', weight='bold')
        ax.grid(True, alpha=0.3, color='#555555', linewidth=1.2)
        
        # Style the spines
        for spine in ax.spines.values():
            spine.set_color('#888888')
            spine.set_linewidth(2)
        
        ax.tick_params(colors='white', labelsize=12, width=1.5)
        
        # Initialize line objects with enhanced styling
        lines = {}
        scatters = {}
        for user in all_users:
            line, = ax.plot([], [], linewidth=3, color=user_colors[user], 
                           label=user, alpha=0.9, solid_capstyle='round',
                           marker='o', markersize=6, markeredgewidth=2, 
                           markeredgecolor='white')
            lines[user] = line
            
            # Add enhanced scatter points
            scatter = ax.scatter([], [], s=100, color=user_colors[user], 
                               alpha=1.0, edgecolors='white', linewidth=2,
                               zorder=5)
            scatters[user] = scatter
        
        # Enhanced title
        title = ax.text(0.5, 0.95, '', transform=ax.transAxes, 
                       fontsize=20, ha='center', va='top', color='white',
                       weight='bold')
        
        # Enhanced legend positioned outside plot area
        legend = ax.legend(bbox_to_anchor=(1.02, 1), loc='upper left', 
                          fontsize=12, frameon=True, facecolor='#1a1a1a', 
                          edgecolor='#666666', labelcolor='white',
                          borderpad=1, columnspacing=1, handlelength=2)
        
        for text in legend.get_texts():
            text.set_weight('bold')
        
        # Add performance guide and controls
        controls_text = ('Interactive Controls:\n'
                        '• Scroll up/down to navigate days\n'
                        '• Arrow keys ← → for day navigation\n'
                        '• Higher on chart = Better\n'
                        '• 1 = Perfect game • X = Failed')
        
        ax.text(0.02, 0.85, controls_text, 
               transform=ax.transAxes, fontsize=10, color='#CCCCCC',
               verticalalignment='top', weight='bold',
               bbox=dict(boxstyle='round,pad=0.6', facecolor='#1a1a1a', 
                        edgecolor='#666666', alpha=0.9, linewidth=1.5))
        
        plt.tight_layout()
        
        # State variables for interactivity
        self.current_center = window_size // 2  # Start at beginning
        self.window_size = window_size
        self.sorted_days = sorted_days
        self.day_data = day_data
        self.all_users = all_users
        self.lines = lines
        self.scatters = scatters
        self.title = title
        self.ax = ax
        
        def update_plot():
            """Update the plot for current window position"""
            # Calculate window bounds
            window_start = max(0, self.current_center - self.window_size // 2)
            window_end = min(len(self.sorted_days) - 1, self.current_center + self.window_size // 2)
            
            # Adjust center if at boundaries
            if window_start == 0:
                window_end = min(self.window_size - 1, len(self.sorted_days) - 1)
            elif window_end == len(self.sorted_days) - 1:
                window_start = max(0, len(self.sorted_days) - self.window_size)
            
            # Set X-axis limits
            start_day = self.sorted_days[window_start]
            end_day = self.sorted_days[window_end]
            self.ax.set_xlim(start_day - 0.5, end_day + 0.5)
            
            # Update title
            center_day = self.sorted_days[self.current_center]
            progress = (self.current_center + 1) / len(self.sorted_days) * 100
            self.title.set_text(f'Interactive Wordle Progress - Day {center_day} ({progress:.0f}%) - Use scroll or arrow keys to navigate')
            
            # Update each user's data within the window
            for user in self.all_users:
                x_data = []
                y_data = []
                
                # Collect data within window
                for day_idx in range(window_start, window_end + 1):
                    if day_idx < len(self.sorted_days):
                        day = self.sorted_days[day_idx]
                        if user in self.day_data[day] and self.day_data[day][user] is not None:
                            x_data.append(day)
                            y_data.append(self.day_data[day][user])
                
                # Update line and scatter
                self.lines[user].set_data(x_data, y_data)
                if x_data:
                    self.scatters[user].set_offsets(np.column_stack([x_data, y_data]))
                    self.scatters[user].set_sizes([120] * len(x_data))
                else:
                    self.scatters[user].set_offsets(np.empty((0, 2)))
            
            plt.draw()
        
        def on_scroll(event):
            """Handle scroll wheel events"""
            if event.inaxes != ax:
                return
            
            # Scroll direction
            direction = 1 if event.button == 'up' else -1
            
            # Update center position
            new_center = self.current_center - direction * 2  # Move 2 days per scroll
            self.current_center = max(self.window_size // 2, 
                                    min(len(self.sorted_days) - 1 - self.window_size // 2, 
                                        new_center))
            
            update_plot()
        
        def on_key(event):
            """Handle keyboard events"""
            if event.key == 'left':
                self.current_center = max(self.window_size // 2, self.current_center - 1)
                update_plot()
            elif event.key == 'right':
                self.current_center = min(len(self.sorted_days) - 1 - self.window_size // 2, 
                                        self.current_center + 1)
                update_plot()
            elif event.key == 'home':
                self.current_center = self.window_size // 2
                update_plot()
            elif event.key == 'end':
                self.current_center = len(self.sorted_days) - 1 - self.window_size // 2
                update_plot()
        
        # Connect event handlers
        fig.canvas.mpl_connect('scroll_event', on_scroll)
        fig.canvas.mpl_connect('key_press_event', on_key)
        
        # Initial plot update
        update_plot()
        
        # Instructions
        print("\n" + "="*60)
        print("INTERACTIVE PLOT CONTROLS:")
        print("• Mouse scroll wheel: Navigate through days (2 days per scroll)")
        print("• Left/Right arrow keys: Move one day at a time")
        print("• Home key: Go to beginning")
        print("• End key: Go to end")
        print("• Close the plot window when done")
        print("="*60)
        
        plt.show()
        return True


def main():
    """Interactive interface for modern video generation"""
    # Import legacy generator
    try:
        from wordle_video_generator import WordleVideoGenerator
        legacy_available = True
    except ImportError:
        legacy_available = False
    
    modern_generator = ModernWordleVideoGenerator()
    
    print("Modern Wordle Video Generator")
    print("=" * 50)
    
    while True:
        print("\nVisualization Options:")
        print("1. Modern 2D Animation (Enhanced styling, dark theme)")
        print("2. Modern 3D Animation (Rotating 3D visualization)")
        print("3. Interactive Scrollable Plot (Navigate with scroll/arrows)")
        if legacy_available:
            print("4. Legacy 2D Animation (Classic version)")
        print("0. Exit")
        
        choice = input(f"\nChoose option (1-{4 if legacy_available else 3}): ").strip()
        
        if choice == '1':
            # Modern 2D
            fps = input("Enter FPS (default 4): ").strip()
            fps = int(fps) if fps.isdigit() else 4
            
            duration = input("Enter seconds per day (default 1.5): ").strip()
            duration = float(duration) if duration.replace('.', '').isdigit() else 1.5
            
            filename = input("Enter filename (default: wordle_modern_2d.mp4): ").strip()
            filename = filename if filename else "../../media/wordle_modern_2d.mp4"
            
            modern_generator.create_modern_2d_animation(filename, fps, duration)
            
        elif choice == '2':
            # Modern 3D
            fps = input("Enter FPS (default 4): ").strip()
            fps = int(fps) if fps.isdigit() else 4
            
            duration = input("Enter seconds per day (default 0.4): ").strip()
            duration = float(duration) if duration.replace('.', '').isdigit() else 0.4
            
            filename = input("Enter filename (default: wordle_modern_3d.mp4): ").strip()
            filename = filename if filename else "../../media/wordle_modern_3d.mp4"
            
            modern_generator.create_modern_3d_animation(filename, fps, duration)
            
        elif choice == '3':
            # Interactive plot
            window_size = input("Enter window size (days to show, default 5): ").strip()
            window_size = int(window_size) if window_size.isdigit() else 5
            
            modern_generator.create_interactive_plot(window_size)
            
        elif choice == '4' and legacy_available:
            # Legacy version
            legacy_generator = WordleVideoGenerator()
            
            format_choice = input("Format - 1: GIF, 2: MP4 (default 2): ").strip()
            is_mp4 = format_choice != '1'
            
            fps = input("Enter FPS (default 3): ").strip()
            fps = int(fps) if fps.isdigit() else 3
            
            duration = input("Enter seconds per day (default 0.3): ").strip()
            duration = float(duration) if duration.replace('.', '').isdigit() else 0.3
            
            extension = '.mp4' if is_mp4 else '.gif'
            filename = input(f"Enter filename (default: wordle_legacy{extension}): ").strip()
            filename = filename if filename else f"wordle_legacy{extension}"
            
            legacy_generator.create_animation(filename, fps, duration)
            
        elif choice == '0':
            print("Goodbye!")
            break
            
        else:
            print("Invalid choice. Please try again.")


if __name__ == "__main__":
    main()