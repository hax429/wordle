#!/usr/bin/env python3
import sys
import sqlite3
from wordle_sqlite_tracker import WordleSQLiteTracker

def diagnose_database(db_file):
    """Diagnose database for missing days, duplicates, and inconsistencies"""
    
    print("🔍 Wordle Database Diagnosis")
    print("="*50)
    print(f"Database file: {db_file}")
    
    try:
        conn = sqlite3.connect(db_file)
        cursor = conn.cursor()
        
        # Get all streak days
        cursor.execute('SELECT day FROM streaks ORDER BY day')
        streak_days = [row[0] for row in cursor.fetchall()]
        
        if not streak_days:
            print("❌ Database is empty - no streak days found!")
            return
        
        min_day = min(streak_days)
        max_day = max(streak_days)
        expected_days = set(range(min_day, max_day + 1))
        actual_days = set(streak_days)
        
        print(f"\n📊 OVERVIEW:")
        print(f"   • Total streak days in database: {len(streak_days)}")
        print(f"   • Day range: {min_day} to {max_day}")
        print(f"   • Expected consecutive days: {len(expected_days)}")
        
        # Check for duplicates
        duplicates = []
        seen = set()
        for day in streak_days:
            if day in seen:
                duplicates.append(day)
            else:
                seen.add(day)
        
        # Check for missing days
        missing_days = expected_days - actual_days
        
        # Check for gaps (non-consecutive sequences)
        gaps = []
        for i in range(len(streak_days) - 1):
            if streak_days[i+1] - streak_days[i] > 1:
                gap_start = streak_days[i] + 1
                gap_end = streak_days[i+1] - 1
                gaps.append((gap_start, gap_end))
        
        # Results summary
        print(f"\n🔍 DIAGNOSIS RESULTS:")
        
        if not missing_days and not duplicates:
            print("✅ DATABASE IS HEALTHY!")
            print("   • No missing days")
            print("   • No duplicate days")
            print("   • All days are consecutive")
        else:
            if missing_days:
                print(f"❌ MISSING DAYS ({len(missing_days)}):")
                missing_list = sorted(list(missing_days))
                if len(missing_list) <= 20:
                    print(f"   • Days: {', '.join(map(str, missing_list))}")
                else:
                    print(f"   • Days: {', '.join(map(str, missing_list[:10]))} ... {', '.join(map(str, missing_list[-10:]))}")
                    print(f"   • (showing first 10 and last 10 of {len(missing_list)} missing days)")
            
            if duplicates:
                print(f"❌ DUPLICATE DAYS ({len(duplicates)}):")
                print(f"   • Days: {', '.join(map(str, sorted(duplicates)))}")
            
            if gaps:
                print(f"⚠️  NON-CONSECUTIVE SEQUENCES ({len(gaps)} gaps):")
                for gap_start, gap_end in gaps:
                    if gap_start == gap_end:
                        print(f"   • Gap at day {gap_start}")
                    else:
                        print(f"   • Gap from day {gap_start} to {gap_end}")
        
        # Check for orphaned data
        cursor.execute('''
            SELECT COUNT(*) FROM results r
            WHERE r.streak_day NOT IN (SELECT day FROM streaks)
        ''')
        orphaned_results = cursor.fetchone()[0]
        
        cursor.execute('''
            SELECT COUNT(*) FROM users u
            WHERE u.id NOT IN (SELECT DISTINCT user_id FROM results)
        ''')
        orphaned_users = cursor.fetchone()[0]
        
        if orphaned_results or orphaned_users:
            print(f"\n⚠️  DATA INTEGRITY ISSUES:")
            if orphaned_results:
                print(f"   • {orphaned_results} orphaned results (results without corresponding streak)")
            if orphaned_users:
                print(f"   • {orphaned_users} orphaned users (users without any results)")
        
        # Detailed day-by-day analysis
        if len(streak_days) <= 50:  # Only show for smaller datasets
            print(f"\n📅 DAY-BY-DAY ANALYSIS:")
            cursor.execute('''
                SELECT s.day, COUNT(r.id) as participants,
                       GROUP_CONCAT(u.username || '(' || r.score || ')') as user_scores
                FROM streaks s
                LEFT JOIN results r ON s.day = r.streak_day
                LEFT JOIN users u ON r.user_id = u.id
                GROUP BY s.day
                ORDER BY s.day
            ''')
            
            for day, participants, user_scores in cursor.fetchall():
                user_scores = user_scores or "No participants"
                if participants == 0:
                    print(f"   • Day {day}: ❌ NO PARTICIPANTS")
                elif participants < 2:
                    print(f"   • Day {day}: ⚠️  Only {participants} participant - {user_scores}")
                else:
                    # Truncate long user lists
                    if len(user_scores) > 80:
                        user_scores = user_scores[:77] + "..."
                    print(f"   • Day {day}: {participants} participants - {user_scores}")
        
        # Quick fix suggestions
        if missing_days or duplicates or orphaned_results or orphaned_users:
            print(f"\n💡 QUICK FIX SUGGESTIONS:")
            if missing_days:
                print("   • For missing days: Check your source data and re-import missing messages")
            if duplicates:
                print("   • For duplicates: Run database cleanup to remove duplicate entries")
            if orphaned_results or orphaned_users:
                print("   • For orphaned data: Run database integrity repair")
        
        conn.close()
        
    except sqlite3.Error as e:
        print(f"❌ Database error: {e}")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Main diagnosis function"""
    db_file = "../../data/wordle_database.db"  # Default database file
    
    # Allow specifying different database file as argument
    if len(sys.argv) > 1:
        db_file = sys.argv[1]
    
    try:
        diagnose_database(db_file)
    except FileNotFoundError:
        print(f"❌ Database file '{db_file}' not found!")
        print("💡 Make sure you've run some imports first, or specify the correct database file.")
    except Exception as e:
        print(f"❌ Error: {e}")

if __name__ == "__main__":
    main()