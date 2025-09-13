#!/usr/bin/env python3
"""
Database Manager - Visualize Wordle database and manage specific days
"""

import os
import sys
import sqlite3
from typing import Dict, List, Tuple, Optional
from datetime import datetime
import json

# Add the src directory to the Python path
current_dir = os.path.dirname(os.path.abspath(__file__))
src_dir = os.path.join(current_dir, '..')  # Go up to src directory
sys.path.insert(0, src_dir)

from utils.common import WordleCommon

class WordleDatabaseManager:
    """Manage and visualize Wordle database with deletion capabilities"""
    
    def __init__(self, db_file: str = None):
        self.db_file = db_file or WordleCommon.DEFAULT_DB_PATH
        self.ensure_database_exists()
    
    def ensure_database_exists(self):
        """Check if database file exists"""
        if not os.path.exists(self.db_file):
            raise FileNotFoundError(f"Database file '{self.db_file}' not found!")
    
    def get_database_overview(self) -> Dict:
        """Get comprehensive overview of the database"""
        conn = WordleCommon.get_db_connection(self.db_file)
        cursor = conn.cursor()
        
        # Get streak days
        cursor.execute('SELECT day FROM streaks ORDER BY day')
        streak_days = [row[0] for row in cursor.fetchall()]
        
        # Get users
        cursor.execute('SELECT id, username FROM users ORDER BY username')
        users = cursor.fetchall()
        
        # Get total results
        cursor.execute('SELECT COUNT(*) FROM results')
        total_results = cursor.fetchone()[0]
        
        # Get day-by-day data
        cursor.execute('''
            SELECT s.day, 
                   COUNT(r.id) as participants,
                   GROUP_CONCAT(u.username || ':' || r.score) as user_scores,
                   s.imported_at
            FROM streaks s
            LEFT JOIN results r ON s.day = r.streak_day
            LEFT JOIN users u ON r.user_id = u.id
            GROUP BY s.day, s.imported_at
            ORDER BY s.day
        ''')
        
        day_data = []
        for day, participants, user_scores, imported_at in cursor.fetchall():
            user_score_list = []
            if user_scores:
                for user_score in user_scores.split(','):
                    username, score = user_score.split(':', 1)
                    user_score_list.append({'username': username, 'score': score})
            
            day_data.append({
                'day': day,
                'participants': participants,
                'user_scores': user_score_list,
                'imported_at': imported_at
            })
        
        conn.close()
        
        return {
            'streak_days': streak_days,
            'users': users,
            'total_results': total_results,
            'day_data': day_data
        }
    
    def visualize_database(self):
        """Display a comprehensive visualization of the database"""
        print("📊 Wordle Database Visualization")
        print("=" * 60)
        print(f"Database: {self.db_file}")
        print()
        
        try:
            overview = self.get_database_overview()
            
            if not overview['streak_days']:
                print("❌ Database is empty!")
                return
            
            # Overview statistics
            min_day = min(overview['streak_days'])
            max_day = max(overview['streak_days'])
            total_days = len(overview['streak_days'])
            expected_days = max_day - min_day + 1
            
            print(f"📈 OVERVIEW:")
            print(f"   • Total days in database: {total_days}")
            print(f"   • Day range: {min_day} to {max_day}")
            print(f"   • Expected consecutive days: {expected_days}")
            print(f"   • Missing days: {expected_days - total_days}")
            print(f"   • Total users: {len(overview['users'])}")
            print(f"   • Total results: {overview['total_results']}")
            print()
            
            # Users list
            print(f"👥 USERS ({len(overview['users'])}):")
            for user_id, username in overview['users']:
                print(f"   • {username} (ID: {user_id})")
            print()
            
            # Day-by-day breakdown
            print(f"📅 DAY-BY-DAY BREAKDOWN:")
            print("-" * 60)
            
            for day_info in overview['day_data']:
                day = day_info['day']
                participants = day_info['participants']
                user_scores = day_info['user_scores']
                imported_at = day_info['imported_at']
                
                # Format imported date
                if imported_at:
                    try:
                        import_date = datetime.fromisoformat(imported_at.replace('Z', '+00:00'))
                        import_str = import_date.strftime('%Y-%m-%d %H:%M')
                    except:
                        import_str = imported_at
                else:
                    import_str = "Unknown"
                
                print(f"Day {day:3d} | {participants:2d} participants | Imported: {import_str}")
                
                if participants == 0:
                    print("        ❌ NO PARTICIPANTS")
                elif participants < 3:
                    print("        ⚠️  Low participation")
                
                # Show user scores
                if user_scores:
                    score_summary = {}
                    for user_score in user_scores:
                        score = user_score['score']
                        if score not in score_summary:
                            score_summary[score] = []
                        score_summary[score].append(user_score['username'])
                    
                    score_line = "        "
                    for score in sorted(score_summary.keys(), key=lambda x: WordleCommon.score_to_numeric(x)):
                        users_with_score = score_summary[score]
                        if len(users_with_score) == 1:
                            score_line += f"{score}: {users_with_score[0]}  "
                        else:
                            score_line += f"{score}: {', '.join(users_with_score)}  "
                    
                    # Wrap long lines
                    if len(score_line) > 100:
                        score_line = score_line[:97] + "..."
                    
                    print(score_line)
                
                print()
        
        except Exception as e:
            print(f"❌ Error visualizing database: {e}")
    
    def list_days(self, limit: int = None) -> List[int]:
        """List all days in the database"""
        conn = WordleCommon.get_db_connection(self.db_file)
        cursor = conn.cursor()
        
        query = 'SELECT day FROM streaks ORDER BY day'
        if limit:
            query += f' LIMIT {limit}'
        
        cursor.execute(query)
        days = [row[0] for row in cursor.fetchall()]
        conn.close()
        
        return days
    
    def get_day_details(self, day: int) -> Optional[Dict]:
        """Get detailed information about a specific day"""
        conn = WordleCommon.get_db_connection(self.db_file)
        cursor = conn.cursor()
        
        # Check if day exists
        cursor.execute('SELECT day, imported_at FROM streaks WHERE day = ?', (day,))
        streak_data = cursor.fetchone()
        
        if not streak_data:
            conn.close()
            return None
        
        # Get results for this day
        cursor.execute('''
            SELECT u.username, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.streak_day = ?
            ORDER BY u.username
        ''', (day,))
        
        results = []
        for username, score, is_winner in cursor.fetchall():
            results.append({
                'username': username,
                'score': score,
                'is_winner': bool(is_winner)
            })
        
        conn.close()
        
        return {
            'day': streak_data[0],
            'imported_at': streak_data[1],
            'participants': len(results),
            'results': results
        }
    
    def delete_day(self, day: int, confirm: bool = False) -> bool:
        """Delete a specific day and all its associated data"""
        # Get day details first
        day_details = self.get_day_details(day)
        
        if not day_details:
            print(f"❌ Day {day} not found in database!")
            return False
        
        print(f"\n⚠️  DELETION PREVIEW for Day {day}:")
        print(f"   • Participants: {day_details['participants']}")
        print(f"   • Imported: {day_details['imported_at']}")
        print("   • Results to be deleted:")
        
        for result in day_details['results']:
            winner_mark = "👑 " if result['is_winner'] else ""
            print(f"     - {winner_mark}{result['username']}: {result['score']}")
        
        if not confirm:
            print(f"\n❓ Are you sure you want to delete Day {day} and all its data?")
            confirmation = input("   Type 'DELETE' to confirm, or anything else to cancel: ").strip()
            
            if confirmation != 'DELETE':
                print("❌ Deletion cancelled.")
                return False
        
        try:
            conn = WordleCommon.get_db_connection(self.db_file)
            cursor = conn.cursor()
            
            # Start transaction
            cursor.execute('BEGIN TRANSACTION')
            
            # Delete results for this day
            cursor.execute('DELETE FROM results WHERE streak_day = ?', (day,))
            deleted_results = cursor.rowcount
            
            # Delete the streak day
            cursor.execute('DELETE FROM streaks WHERE day = ?', (day,))
            deleted_streaks = cursor.rowcount
            
            # Commit transaction
            cursor.execute('COMMIT')
            conn.close()
            
            print(f"✅ Successfully deleted Day {day}!")
            print(f"   • Removed {deleted_results} results")
            print(f"   • Removed {deleted_streaks} streak record")
            
            return True
            
        except Exception as e:
            print(f"❌ Error deleting day {day}: {e}")
            try:
                cursor.execute('ROLLBACK')
                conn.close()
            except:
                pass
            return False
    
    def interactive_mode(self):
        """Interactive mode for database management"""
        while True:
            print("\n🎯 Database Manager - Interactive Mode")
            print("=" * 50)
            print("1. Visualize entire database")
            print("2. Show specific day details")
            print("3. List all days")
            print("4. Delete specific day")
            print("5. Exit")
            print()
            
            choice = input("Enter your choice (1-5): ").strip()
            
            if choice == '1':
                print("\n" + "="*60)
                self.visualize_database()
                
            elif choice == '2':
                day_input = input("\nEnter day number: ").strip()
                try:
                    day = int(day_input)
                    details = self.get_day_details(day)
                    
                    if details:
                        print(f"\n📅 Details for Day {day}:")
                        print(f"   • Participants: {details['participants']}")
                        print(f"   • Imported: {details['imported_at']}")
                        print("   • Results:")
                        
                        for result in details['results']:
                            winner_mark = "👑 " if result['is_winner'] else ""
                            print(f"     - {winner_mark}{result['username']}: {result['score']}")
                    else:
                        print(f"❌ Day {day} not found!")
                        
                except ValueError:
                    print("❌ Please enter a valid day number!")
            
            elif choice == '3':
                print("\n📅 All days in database:")
                days = self.list_days()
                
                if days:
                    # Group days for better display
                    for i in range(0, len(days), 10):
                        day_group = days[i:i+10]
                        print(f"   {', '.join(map(str, day_group))}")
                    print(f"\nTotal: {len(days)} days")
                else:
                    print("❌ No days found in database!")
            
            elif choice == '4':
                day_input = input("\nEnter day number to delete: ").strip()
                try:
                    day = int(day_input)
                    self.delete_day(day)
                except ValueError:
                    print("❌ Please enter a valid day number!")
            
            elif choice == '5':
                print("👋 Goodbye!")
                break
            
            else:
                print("❌ Invalid choice! Please enter 1-5.")


def main():
    """Main entry point"""
    print("🗄️  Wordle Database Manager")
    print("Visualize database and manage specific days")
    print()
    
    # Handle command line arguments
    db_file = None
    if len(sys.argv) > 1:
        if sys.argv[1] in ['--help', '-h']:
            print("Usage:")
            print("  python database_manager.py                    # Interactive mode")
            print("  python database_manager.py [db_file]          # Interactive with custom DB")
            print("  python database_manager.py visualize [db_file] # Just visualize")
            print("  python database_manager.py delete <day> [db_file] # Delete specific day")
            return
        elif sys.argv[1] == 'visualize':
            db_file = sys.argv[2] if len(sys.argv) > 2 else None
            manager = WordleDatabaseManager(db_file)
            manager.visualize_database()
            return
        elif sys.argv[1] == 'delete' and len(sys.argv) > 2:
            try:
                day = int(sys.argv[2])
                db_file = sys.argv[3] if len(sys.argv) > 3 else None
                manager = WordleDatabaseManager(db_file)
                manager.delete_day(day)
                return
            except ValueError:
                print("❌ Invalid day number!")
                return
        else:
            db_file = sys.argv[1]
    
    try:
        manager = WordleDatabaseManager(db_file)
        manager.interactive_mode()
    
    except FileNotFoundError as e:
        print(f"❌ {e}")
        print("💡 Make sure you've imported some data first!")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == '__main__':
    main()