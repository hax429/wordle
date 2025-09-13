#!/usr/bin/env python3
import sys
from wordle_sqlite_tracker import WordleSQLiteTracker

def main():
    """Clear database utility"""
    db_file = "../../data/wordle_database.db"  # Default database file
    
    # Allow specifying different database file as argument
    if len(sys.argv) > 1:
        db_file = sys.argv[1]
    
    tracker = WordleSQLiteTracker(db_file)
    
    print("🗑️  Wordle Database Cleaner")
    print("="*40)
    print(f"Database file: {db_file}")
    
    # Show current database state
    print("\n📊 CURRENT DATABASE STATE:")
    overview = tracker.get_brief_overview()
    
    if overview['total_entries'] == 0:
        print("   • Database is already empty!")
        return
    
    print(f"   • {overview['total_streaks']} streak days")
    print(f"   • {overview['total_users']} users") 
    print(f"   • {overview['total_entries']} total entries")
    print(f"   • Users: {', '.join(overview['users'])}")
    
    # Confirmation
    print(f"\n⚠️  WARNING: This will permanently delete ALL data from {db_file}")
    confirm1 = input("Are you sure you want to clear the database? (yes/no): ").strip().lower()
    
    if confirm1 != 'yes':
        print("❌ Operation cancelled.")
        return
    
    # Double confirmation for safety
    print("\n🚨 FINAL WARNING: This action cannot be undone!")
    confirm2 = input("Type 'DELETE ALL DATA' to confirm: ").strip()
    
    if confirm2 != 'DELETE ALL DATA':
        print("❌ Operation cancelled.")
        return
    
    # Clear the database
    try:
        tracker.clear_database()
        print("\n✅ Database cleared successfully!")
        
        # Show empty state
        print("\n📊 DATABASE STATE AFTER CLEARING:")
        tracker.print_brief_overview()
        
    except Exception as e:
        print(f"\n❌ Error clearing database: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()