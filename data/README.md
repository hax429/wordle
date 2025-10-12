# Data Directory

This directory contains your Wordle statistics database.

## Database File

`wordle.db` - SQLite database with all your Wordle tracking data

## Schema

```sql
users (id, username, first_seen)
streaks (id, day, imported_at)  
results (id, streak_day, user_id, score, is_winner)
```

## Backup

The database is automatically backed up when you click "Download Backup" in the admin console.

You can also manually backup:
```bash
cp data/wordle.db backups/wordle_$(date +%Y%m%d).db
```

## Migrate from Python Version

If you have an existing database from the Python version:
```bash
cp /path/to/old/wordle_database.db data/wordle.db
```

The schema is 100% compatible!

## Direct Access

View database contents:
```bash
sqlite3 data/wordle.db
sqlite> .tables
sqlite> SELECT * FROM users;
sqlite> .quit
```

**Note**: Database is created automatically on first run if it doesn't exist.


