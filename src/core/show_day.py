#!/usr/bin/env python3
import sys
import sqlite3
from datetime import datetime

def show_day_data(db_file, day):
    """Show detailed data for a specific streak day"""
    
    print(f"📅 Wordle Day {day} Details")
    print("="*50)
    print(f"Database: {db_file}")
    
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Check if day exists
        cursor.execute('SELECT day, imported_at FROM streaks WHERE day = ?', (day,))
        streak_info = cursor.fetchone()
        
        if not streak_info:
            print(f"\n❌ Day {day} not found in database!")
            
            # Show nearby days for context
            cursor.execute('''
                SELECT day FROM streaks 
                WHERE day BETWEEN ? AND ? 
                ORDER BY day
            ''', (day - 5, day + 5))
            
            nearby_days = [row[0] for row in cursor.fetchall()]
            if nearby_days:
                print(f"📍 Nearby days in database: {', '.join(map(str, nearby_days))}")
            else:
                print("📍 No nearby days found in database.")
            
            conn.close()
            return
        
        streak_day, imported_at = streak_info
        
        print(f"✅ Day {streak_day} found!")
        if imported_at:
            print(f"📝 Imported: {imported_at}")
        
        # Get all results for this day
        cursor.execute('''
            SELECT u.username, r.score, r.is_winner
            FROM results r
            JOIN users u ON r.user_id = u.id
            WHERE r.streak_day = ?
            ORDER BY 
                CASE r.score 
                    WHEN '1' THEN 1 WHEN '2' THEN 2 WHEN '3' THEN 3 
                    WHEN '4' THEN 4 WHEN '5' THEN 5 WHEN '6' THEN 6 
                    WHEN 'X' THEN 7 
                END,
                u.username
        ''', (day,))
        
        results = cursor.fetchall()
        
        if not results:
            print(f"\n⚠️  No participants found for Day {day}")
            conn.close()
            return
        
        # Display results
        print(f"\n🎯 RESULTS FOR DAY {day}:")
        print(f"👥 Total participants: {len(results)}")
        
        # Group by score
        score_groups = {}
        winner_found = False
        
        for username, score, is_winner in results:
            if score not in score_groups:
                score_groups[score] = []
            score_groups[score].append((username, is_winner))
            if is_winner:
                winner_found = True
        
        # Display by score
        score_order = ['1', '2', '3', '4', '5', '6', 'X']
        for score in score_order:
            if score in score_groups:
                users_with_score = score_groups[score]
                print(f"\n{score}/6: ({len(users_with_score)} {'player' if len(users_with_score) == 1 else 'players'})")
                
                for username, is_winner in users_with_score:
                    crown = "👑 " if is_winner else "   "
                    print(f"{crown}{username}")
        
        # Statistics
        print(f"\n📊 STATISTICS:")
        total_players = len(results)
        successful_players = len([r for r in results if r[1] != 'X'])
        failed_players = len([r for r in results if r[1] == 'X'])
        
        print(f"   • Total players: {total_players}")
        print(f"   • Successful: {successful_players} ({successful_players/total_players*100:.1f}%)")
        if failed_players > 0:
            print(f"   • Failed (X): {failed_players} ({failed_players/total_players*100:.1f}%)")
        
        if winner_found:
            winners = [r[0] for r in results if r[2]]
            print(f"   • Winner(s): {', '.join(winners)}")
        
        # Calculate average score (excluding X)
        if successful_players > 0:
            total_score = sum(int(r[1]) for r in results if r[1] != 'X')
            avg_score = total_score / successful_players
            print(f"   • Average score: {avg_score:.2f}/6")
        
        # Best and worst performers
        best_score = min((int(r[1]) for r in results if r[1] != 'X'), default=None)
        if best_score:
            best_players = [r[0] for r in results if r[1] == str(best_score)]
            print(f"   • Best score: {best_score}/6 by {', '.join(best_players)}")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

def show_recent_days(db_file, count=5):
    """Show recent days in database"""
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        cursor.execute('SELECT day FROM streaks ORDER BY day DESC LIMIT ?', (count,))
        recent_days = [row[0] for row in cursor.fetchall()]
        
        if recent_days:
            print(f"📅 Recent {len(recent_days)} days in database:")
            print(f"   {', '.join(map(str, reversed(recent_days)))}")
        else:
            print("📅 No days found in database")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Error showing recent days: {e}")

def main():
    """Main function to show day data"""
    db_file = "../../data/wordle_database.db"  # Default database file
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("🎯 Wordle Day Viewer")
        print("="*30)
        print("Usage:")
        print(f"  {sys.argv[0]} <day_number> [database_file]")
        print(f"  {sys.argv[0]} recent [database_file]  # Show recent days")
        print("")
        print("Examples:")
        print(f"  {sys.argv[0]} 100                    # Show day 100")
        print(f"  {sys.argv[0]} 50 custom.db           # Show day 50 from custom.db")
        print(f"  {sys.argv[0]} recent                 # Show recent days")
        
        # Show recent days as help
        try:
            show_recent_days(db_file)
        except:
            pass
        return
    
    day_arg = sys.argv[1]
    
    # Allow custom database file
    if len(sys.argv) > 2:
        db_file = sys.argv[2]
    
    try:
        if day_arg.lower() == 'recent':
            count = 10 if len(sys.argv) <= 2 else int(sys.argv[2]) if sys.argv[2].isdigit() else 10
            show_recent_days(db_file, count)
        else:
            day = int(day_arg)
            if day < 1:
                print("❌ Day number must be positive!")
                return
            show_day_data(db_file, day)
            
    except ValueError:
        print(f"❌ Invalid day number: '{day_arg}'")
        print("💡 Day must be a positive integer or 'recent'")
    except FileNotFoundError:
        print(f"❌ Database file '{db_file}' not found!")
        print("💡 Make sure you've run some imports first, or specify the correct database file.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()