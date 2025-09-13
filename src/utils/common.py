#!/usr/bin/env python3
"""
Common utilities and shared functions for Wordle scripts.
"""

import os
import sys
import sqlite3
from typing import Optional

class WordleCommon:
    """Shared utilities and constants for Wordle scripts."""
    
    # Common database path
    DEFAULT_DB_PATH = "../../data/wordle_database.db"
    
    @staticmethod
    def setup_paths(target_subdir: str) -> str:
        """
        Set up paths and change directory for scripts.
        
        Args:
            target_subdir: The subdirectory under src/ to navigate to (e.g., 'web', 'video')
        
        Returns:
            The path to the target directory
        """
        current_dir = os.path.dirname(os.path.abspath(__file__))
        # Go up from utils to src, then to target subdir
        target_dir = os.path.join(current_dir, '..', target_subdir)
        src_dir = os.path.join(current_dir, '..', target_subdir)
        sys.path.insert(0, src_dir)
        
        # Change to the target directory so relative paths work
        os.chdir(target_dir)
        return target_dir
    
    @staticmethod
    def score_to_numeric(score: str) -> int:
        """Convert Wordle score to numeric value, treating X as 7"""
        return 7 if score == 'X' else int(score)
    
    @staticmethod
    def get_db_connection(db_file: Optional[str] = None) -> sqlite3.Connection:
        """Get a database connection using the standard path"""
        if db_file is None:
            db_file = WordleCommon.DEFAULT_DB_PATH
        return sqlite3.connect(db_file)
    
    @staticmethod
    def print_header(title: str, emoji: str = "🎯"):
        """Print a consistent header format"""
        print(f"{emoji} {title}")
        print(f"📁 Working directory: {os.getcwd()}")