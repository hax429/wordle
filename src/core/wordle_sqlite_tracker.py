#!/usr/bin/env python3
import sqlite3
import re
from datetime import datetime
from typing import Dict, List, Tuple
import sys
import os

# Add utils to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
from utils.common import WordleCommon

class WordleSQLiteTracker:
    def __init__(self, db_file: str = None):
        self.db_file = db_file or WordleCommon.DEFAULT_DB_PATH
        self.init_database()
    
    def init_database(self):
        """Initialize SQLite database with required tables"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Create users table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create streaks table
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS streaks (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                day INTEGER UNIQUE NOT NULL,
                imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create results table (links users, streaks, and scores)
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                streak_day INTEGER NOT NULL,
                user_id INTEGER NOT NULL,
                score TEXT NOT NULL,
                is_winner BOOLEAN DEFAULT 0,
                FOREIGN KEY (streak_day) REFERENCES streaks (day),
                FOREIGN KEY (user_id) REFERENCES users (id),
                UNIQUE(streak_day, user_id)
            )
        ''')
        
        conn.commit()
        conn.close()
    
    def parse_message(self, message: str) -> Dict:
        """Parse Wordle streak message and extract data"""
        # Extract streak day
        streak_match = re.search(r'(\d+) day streak', message)
        if not streak_match:
            raise ValueError("Could not find streak day in message")
        
        streak_day = int(streak_match.group(1))
        
        # Extract results
        results = []
        
        # Find all score lines with improved pattern
        # Look for score patterns and capture everything until the next score or end
        score_pattern = r'(👑\s*)?([1-6X])/6:\s*([^👑]*?)(?=(?:[1-6X]/6:|$))'
        score_lines = re.findall(score_pattern, message)
        
        for crown, score, usernames in score_lines:
            # Split by @ and process each potential username
            parts = usernames.split('@')[1:]  # Skip first empty part
            
            for part in parts:
                # Extract username until next @ or score pattern
                # Look for next @ or number/letter followed by /6 pattern
                match = re.match(r'([^@]*?)(?=@|\d/6:|[A-Z]/6:|$)', part)
                if match:
                    raw_username = match.group(1).strip()
                    
                    # Skip empty usernames
                    if not raw_username:
                        continue
                    
                    # Clean username - preserve spaces, emojis, and alphanumeric
                    # Only remove trailing punctuation that's clearly not part of username
                    clean_user = re.sub(r'[,;.!?]+$', '', raw_username)
                    clean_user = clean_user.strip()
                    
                    if clean_user and len(clean_user) > 0:
                        results.append({
                            'username': clean_user,
                            'score': score,
                            'is_winner': bool(crown.strip()) if crown else False
                        })
        
        return {
            "day": streak_day,
            "results": results
        }
    
    def add_user(self, conn, username: str) -> int:
        """Add user to database if not exists, return user_id"""
        cursor = conn.cursor()
        
        cursor.execute('INSERT OR IGNORE INTO users (username) VALUES (?)', (username,))
        cursor.execute('SELECT id FROM users WHERE username = ?', (username,))
        user_id = cursor.fetchone()[0]
        
        return user_id
    
    def add_streak_data(self, message: str) -> Dict:
        """Parse message and add to database"""
        parsed_data = self.parse_message(message)
        streak_day = parsed_data["day"]
        
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            # Add streak day
            cursor.execute('INSERT OR IGNORE INTO streaks (day) VALUES (?)', (streak_day,))
            
            # Add results
            for result in parsed_data["results"]:
                user_id = self.add_user(conn, result['username'])
                
                # Insert or update result
                cursor.execute('''
                    INSERT OR REPLACE INTO results (streak_day, user_id, score, is_winner)
                    VALUES (?, ?, ?, ?)
                ''', (streak_day, user_id, result['score'], result['is_winner']))
            
            conn.commit()
            
            # Return summary
            cursor.execute('SELECT COUNT(*) FROM results WHERE streak_day = ?', (streak_day,))
            results_count = cursor.fetchone()[0]
            
            return {
                "day": streak_day,
                "results_added": results_count,
                "users_in_day": [r['username'] for r in parsed_data["results"]]
            }
            
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def get_brief_overview(self) -> Dict:
        """Get brief overview of database"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        cursor.execute('SELECT COUNT(*) FROM streaks')
        total_streaks = cursor.fetchone()[0]
        
        cursor.execute('SELECT COUNT(*) FROM users')
        total_users = cursor.fetchone()[0]
        
        cursor.execute('SELECT username FROM users ORDER BY username')
        users = [row[0] for row in cursor.fetchall()]
        
        cursor.execute('SELECT COUNT(*) FROM results')
        total_entries = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_streaks": total_streaks,
            "total_users": total_users,
            "total_entries": total_entries,
            "users": users
        }
    
    def get_detailed_overview(self) -> Dict:
        """Get detailed overview of database"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        # Basic stats
        brief = self.get_brief_overview()
        
        # Streak days
        cursor.execute('SELECT day FROM streaks ORDER BY day')
        streak_days = [row[0] for row in cursor.fetchall()]
        
        # User statistics
        cursor.execute('''
            SELECT u.username, 
                   COUNT(*) as games_played,
                   SUM(CASE WHEN r.score = '1' THEN 1 ELSE 0 END) as score_1,
                   SUM(CASE WHEN r.score = '2' THEN 1 ELSE 0 END) as score_2,
                   SUM(CASE WHEN r.score = '3' THEN 1 ELSE 0 END) as score_3,
                   SUM(CASE WHEN r.score = '4' THEN 1 ELSE 0 END) as score_4,
                   SUM(CASE WHEN r.score = '5' THEN 1 ELSE 0 END) as score_5,
                   SUM(CASE WHEN r.score = '6' THEN 1 ELSE 0 END) as score_6,
                   SUM(CASE WHEN r.score = 'X' THEN 1 ELSE 0 END) as score_X,
                   SUM(CASE WHEN r.is_winner = 1 THEN 1 ELSE 0 END) as wins
            FROM users u
            LEFT JOIN results r ON u.id = r.user_id
            GROUP BY u.id, u.username
            ORDER BY games_played DESC, u.username
        ''')
        
        user_stats = []
        for row in cursor.fetchall():
            user_stats.append({
                "username": row[0],
                "games_played": row[1],
                "scores": {
                    "1": row[2], "2": row[3], "3": row[4],
                    "4": row[5], "5": row[6], "6": row[7], "X": row[8]
                },
                "wins": row[9]
            })
        
        # Recent streaks
        cursor.execute('''
            SELECT s.day, COUNT(r.id) as participants
            FROM streaks s
            LEFT JOIN results r ON s.day = r.streak_day
            GROUP BY s.day
            ORDER BY s.day DESC
            LIMIT 10
        ''')
        
        recent_streaks = [{"day": row[0], "participants": row[1]} for row in cursor.fetchall()]
        
        conn.close()
        
        return {
            **brief,
            "streak_days": streak_days,
            "user_stats": user_stats,
            "recent_streaks": recent_streaks
        }
    
    def print_brief_overview(self):
        """Print brief overview"""
        overview = self.get_brief_overview()
        print(f"📊 Database Overview:")
        print(f"   • {overview['total_streaks']} streak days")
        print(f"   • {overview['total_users']} users")
        print(f"   • {overview['total_entries']} total entries")
        print(f"   • Users: {', '.join(overview['users'])}")
    
    def clear_database(self) -> bool:
        """Clear all data from the database"""
        conn = sqlite3.connect(self.db_file)
        cursor = conn.cursor()
        
        try:
            cursor.execute('DELETE FROM results')
            cursor.execute('DELETE FROM streaks')
            cursor.execute('DELETE FROM users')
            conn.commit()
            return True
        except Exception as e:
            conn.rollback()
            raise e
        finally:
            conn.close()
    
    def print_detailed_overview(self):
        """Print detailed overview"""
        overview = self.get_detailed_overview()
        
        print("="*80)
        print("🏆 DETAILED WORDLE DATABASE OVERVIEW")
        print("="*80)
        
        print(f"\n📈 SUMMARY STATISTICS:")
        print(f"   • Total streak days: {overview['total_streaks']}")
        print(f"   • Total users: {overview['total_users']}")
        print(f"   • Total game entries: {overview['total_entries']}")
        
        if overview['streak_days']:
            print(f"   • Streak range: Day {min(overview['streak_days'])} to Day {max(overview['streak_days'])}")
        
        print(f"\n👥 USER STATISTICS:")
        if overview['user_stats']:
            print(f"{'Username':<15} {'Games':<6} {'1':<3} {'2':<3} {'3':<3} {'4':<3} {'5':<3} {'6':<3} {'X':<3} {'Wins':<5}")
            print("-" * 60)
            for user in overview['user_stats']:
                scores = user['scores']
                print(f"{user['username']:<15} {user['games_played']:<6} "
                      f"{scores['1']:<3} {scores['2']:<3} {scores['3']:<3} {scores['4']:<3} "
                      f"{scores['5']:<3} {scores['6']:<3} {scores['X']:<3} {user['wins']:<5}")
        
        print(f"\n📅 RECENT STREAK DAYS:")
        if overview['recent_streaks']:
            for streak in overview['recent_streaks']:
                print(f"   • Day {streak['day']}: {streak['participants']} participants")
        
        print("="*80)


def main():
    """Interactive batch import interface"""
    import signal
    import sys
    
    def signal_handler(sig, frame):
        print("\n\n🛑 Import interrupted by user.")
        print("Data already imported has been saved to the database.")
        print("👋 Goodbye!")
        sys.exit(0)
    
    # Set up signal handler for Ctrl+C
    signal.signal(signal.SIGINT, signal_handler)
    
    tracker = WordleSQLiteTracker()
    
    print("🎯 Wordle Streak Tracker (SQLite Edition)")
    print("="*50)
    print("💡 Tip: Press Ctrl+C anytime to quit gracefully")
    
    # Show initial database state
    print("\n📊 INITIAL DATABASE STATE:")
    tracker.print_detailed_overview()
    
    print("\n🚀 BATCH IMPORT MODE")
    print("Paste your Wordle streak messages below.")
    print("Type 'done' when finished.\n")
    
    import_count = 0
    
    while True:
        try:
            message = input(f"Message {import_count + 1}: ").strip()
            
            if message.lower() == 'done':
                break
                
            if not message:
                continue
            
            # Process message
            result = tracker.add_streak_data(message)
            import_count += 1
            
            print(f"✅ Added Day {result['day']} with {result['results_added']} entries")
            print(f"   Users: {', '.join(result['users_in_day'])}")
            
            # Show brief overview
            tracker.print_brief_overview()
            print()
            
        except ValueError as e:
            print(f"❌ Error parsing message: {e}")
            print("Please check the message format and try again.\n")
        except Exception as e:
            print(f"❌ Database error: {e}")
            print("Please try again.\n")
    
    print(f"\n🎉 IMPORT COMPLETE! Processed {import_count} messages.")
    
    # Show final detailed overview
    print("\n📊 FINAL DATABASE STATE:")
    tracker.print_detailed_overview()


if __name__ == "__main__":
    main()