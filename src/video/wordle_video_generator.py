#!/usr/bin/env python3
import sqlite3
import matplotlib.pyplot as plt
import matplotlib.animation as animation
import numpy as np
from collections import defaultdict
import random
from typing import Dict, List, Tuple
import sys
import os

# Add utils to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.common import WordleCommon

class WordleVideoGenerator:
    def __init__(self, db_file: str = None):
        self.db_file = db_file or WordleCommon.DEFAULT_DB_PATH
        self.colors = [
            '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', 
            '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
            '#F8C471', '#82E0AA', '#F1948A', '#85C1E9'
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
    
    def create_animation(self, output_filename: str = "wordle_progress.gif", 
                        fps: int = 2, duration_per_day: float = 0.5):
        """Create animated plot showing user progress over time"""
        
        print("📊 Extracting data from database...")
        data = self.get_user_data_over_time()
        
        if not data['sorted_days']:
            print("❌ No data found in database!")
            return
        
        day_data = data['day_data']
        sorted_days = data['sorted_days']
        all_users = data['all_users']
        
        print(f"🎯 Found {len(all_users)} users across {len(sorted_days)} days")
        
        # Setup the figure and axis
        fig, ax = plt.subplots(figsize=(12, 8))
        ax.set_xlim(min(sorted_days) - 1, max(sorted_days) + 1)
        ax.set_ylim(0.5, 7.5)
        ax.set_xlabel('Day', fontsize=14)
        ax.set_ylabel('Score', fontsize=14)
        ax.set_title('🎯 Wordle Group Progress Over Time', fontsize=16, pad=20)
        
        # Set Y-axis ticks and labels
        ax.set_yticks([1, 2, 3, 4, 5, 6, 7])
        ax.set_yticklabels(['1', '2', '3', '4', '5', '6', 'X'])
        ax.grid(True, alpha=0.3)
        
        # Assign colors to users
        user_colors = {}
        for i, user in enumerate(all_users):
            user_colors[user] = self.colors[i % len(self.colors)]
        
        # Initialize line objects for each user
        lines = {}
        for user in all_users:
            line, = ax.plot([], [], 'o-', linewidth=2, markersize=6, 
                           color=user_colors[user], label=user, alpha=0.8)
            lines[user] = line
        
        # Add legend
        ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
        plt.tight_layout()
        
        # Animation function
        def animate(frame):
            current_day_idx = frame
            if current_day_idx >= len(sorted_days):
                return list(lines.values())
            
            current_day = sorted_days[current_day_idx]
            
            # Update title with current day
            ax.set_title(f'🎯 Wordle Group Progress - Day {current_day}', 
                        fontsize=16, pad=20)
            
            # Update each user's line
            for user in all_users:
                x_data = []
                y_data = []
                
                # Collect all data up to current day for this user
                for day_idx in range(current_day_idx + 1):
                    day = sorted_days[day_idx]
                    if user in day_data[day] and day_data[day][user] is not None:
                        x_data.append(day)
                        y_data.append(day_data[day][user])
                
                lines[user].set_data(x_data, y_data)
            
            return list(lines.values())
        
        # Create animation
        print(f"🎬 Creating animation with {len(sorted_days)} frames...")
        anim = animation.FuncAnimation(fig, animate, frames=len(sorted_days), 
                                     interval=int(duration_per_day * 1000), 
                                     blit=False, repeat=True)
        
        # Save animation
        print(f"💾 Saving animation as {output_filename}...")
        try:
            if output_filename.endswith('.mp4'):
                # Try to save as MP4 (requires ffmpeg)
                anim.save(output_filename, writer='ffmpeg', fps=fps, 
                         extra_args=['-vcodec', 'libx264'])
                print(f"✅ MP4 video saved as {output_filename}")
            else:
                # Save as GIF (more compatible)
                anim.save(output_filename, writer='pillow', fps=fps)
                print(f"✅ GIF animation saved as {output_filename}")
        except Exception as e:
            print(f"❌ Error saving animation: {e}")
            print("💡 Trying to save as GIF instead...")
            gif_filename = output_filename.replace('.mp4', '.gif')
            try:
                anim.save(gif_filename, writer='pillow', fps=fps)
                print(f"✅ GIF animation saved as {gif_filename}")
            except Exception as e2:
                print(f"❌ Failed to save GIF: {e2}")
                return False
        
        return True
    
    def create_static_summary_plot(self, output_filename: str = "wordle_summary.png"):
        """Create a static summary plot showing all user progressions"""
        print("📊 Creating static summary plot...")
        
        data = self.get_user_data_over_time()
        if not data['sorted_days']:
            print("❌ No data found!")
            return False
        
        day_data = data['day_data']
        sorted_days = data['sorted_days']
        all_users = data['all_users']
        
        fig, ax = plt.subplots(figsize=(14, 8))
        
        # Assign colors to users
        user_colors = {}
        for i, user in enumerate(all_users):
            user_colors[user] = self.colors[i % len(self.colors)]
        
        # Plot each user's complete progression
        for user in all_users:
            x_data = []
            y_data = []
            
            for day in sorted_days:
                if user in day_data[day] and day_data[day][user] is not None:
                    x_data.append(day)
                    y_data.append(day_data[day][user])
            
            if x_data:  # Only plot if user has data
                ax.plot(x_data, y_data, 'o-', linewidth=2, markersize=4, 
                       color=user_colors[user], label=user, alpha=0.8)
        
        ax.set_xlim(min(sorted_days) - 1, max(sorted_days) + 1)
        ax.set_ylim(0.5, 7.5)
        ax.set_xlabel('Day', fontsize=14)
        ax.set_ylabel('Score', fontsize=14)
        ax.set_title('🎯 Wordle Group Progress Summary', fontsize=16, pad=20)
        
        # Set Y-axis ticks and labels
        ax.set_yticks([1, 2, 3, 4, 5, 6, 7])
        ax.set_yticklabels(['1', '2', '3', '4', '5', '6', 'X'])
        ax.grid(True, alpha=0.3)
        ax.legend(bbox_to_anchor=(1.05, 1), loc='upper left', fontsize=10)
        
        plt.tight_layout()
        plt.savefig(output_filename, dpi=300, bbox_inches='tight')
        print(f"✅ Static plot saved as {output_filename}")
        plt.close()
        
        return True


def main():
    """Interactive interface for generating videos"""
    generator = WordleVideoGenerator()
    
    print("🎬 Wordle Progress Video Generator")
    print("=" * 50)
    
    while True:
        print("\nOptions:")
        print("1. Create animated GIF (recommended)")
        print("2. Create MP4 video (requires ffmpeg)")
        print("3. Create static summary plot")
        print("4. Exit")
        
        choice = input("\nChoose option (1-4): ").strip()
        
        if choice == '1':
            fps = input("Enter FPS (default 2): ").strip()
            fps = int(fps) if fps.isdigit() else 2
            
            duration = input("Enter seconds per day (default 0.5): ").strip()
            duration = float(duration) if duration.replace('.', '').isdigit() else 0.5
            
            filename = input("Enter filename (default: wordle_progress.gif): ").strip()
            filename = filename if filename else "wordle_progress.gif"
            
            generator.create_animation(filename, fps, duration)
            
        elif choice == '2':
            fps = input("Enter FPS (default 2): ").strip()
            fps = int(fps) if fps.isdigit() else 2
            
            duration = input("Enter seconds per day (default 0.5): ").strip()
            duration = float(duration) if duration.replace('.', '').isdigit() else 0.5
            
            filename = input("Enter filename (default: wordle_progress.mp4): ").strip()
            filename = filename if filename else "../../media/wordle_progress.mp4"
            
            generator.create_animation(filename, fps, duration)
            
        elif choice == '3':
            filename = input("Enter filename (default: wordle_summary.png): ").strip()
            filename = filename if filename else "wordle_summary.png"
            
            generator.create_static_summary_plot(filename)
            
        elif choice == '4':
            print("👋 Goodbye!")
            break
            
        else:
            print("❌ Invalid choice. Please try again.")


if __name__ == "__main__":
    main()