# Wordle Group Statistics Project - Complete Guide

A comprehensive system for tracking, analyzing, and visualizing Wordle game statistics for groups with web interface, video generation, and statistical analysis.

## 📁 Project Structure

```
wordle/
├── README_COMPLETE.md      # This comprehensive documentation
├── run_web_app.py          # Convenience script to start web app
├── export.py               # Convenience script for HTML export
├── generate_video.py       # Convenience script for video generation
├── src/                    # Source code
│   ├── core/              # Core database utilities
│   │   ├── wordle_sqlite_tracker.py    # Main data tracking class
│   │   ├── clear_database.py           # Database clearing utility
│   │   ├── diagnose_database.py        # Database diagnostic tool
│   │   └── show_day.py                 # View specific day data
│   ├── web/               # Web application
│   │   ├── wordle_stats_app.py         # Flask web application
│   │   ├── templates/                  # HTML templates
│   │   │   ├── stats.html             # Main stats page
│   │   │   ├── plot.html              # Interactive plot page
│   │   │   └── video.html             # Video player page
│   │   └── static/                     # Static web assets
│   │       └── wordle_final_2d.mp4    # Default video file
│   └── video/             # Video generation tools
│       ├── wordle_video_generator.py   # Legacy video generator
│       └── wordle_video_modern.py      # Modern/advanced video generator
├── data/                  # Database files
│   └── wordle_database.db              # SQLite database
├── media/                 # Generated media files
│   ├── wordle_final_2d.mp4            # Main 2D visualization
│   ├── wordle_modern_2d.mp4           # Modern 2D visualization
│   └── wordle_modern_3d.mp4           # 3D visualization
├── exports/               # HTML export files
│   ├── wordle_complete_export.html     # Complete self-contained export
│   ├── beautiful_report.html           # Beautiful report export
│   └── index.html                      # Basic index file
├── backups/               # Database backups (created automatically)
└── docs/                  # Additional documentation
```

---

## 🚀 Quick Start Guide

### 1. Run the Web Application
```bash
python run_web_app.py
```
- Access at: **http://localhost:12001**
- Features: Interactive dashboard, plot navigation, video player
- Mobile responsive with dark/light theme toggle

### 2. Export Self-Contained HTML
```bash
python export.py                    # Default export
python export.py my_export.html     # Custom filename
```
- Creates standalone HTML files with embedded data and videos
- Perfect for sharing or offline viewing
- Includes all statistics, plots, and video player

### 3. Generate Video Visualizations
```bash
python generate_video.py            # Interactive menu
```
- Choose from Legacy 2D, Modern 2D, or Modern 3D animations
- Multiple output formats (MP4, GIF)
- Customizable FPS and timing settings

### 4. Manage Database (Advanced)
```bash
cd src/core
python diagnose_database.py         # Check database health
python show_day.py recent           # View recent data
python clear_database.py            # Clear database (careful!)
```

---

## 🎯 Complete Feature Overview

### 🌐 Web Application Features

#### Interactive Statistics Dashboard
- **Average Score Rankings**: Who has the best average (lower is better)
- **Participation Rankings**: Most active players
- **Score Consistency**: Most consistent performers (low variance)
- **Streak Analysis**: Longest consecutive streaks
- **Total Games**: Overall participation metrics

#### Time Period Analysis
- **All Time**: Complete historical data from your database
- **Last 7 Days**: Recent performance for current trends

#### Advanced Interface
- **Mobile Responsive**: Works perfectly on all devices
- **Dark/Light Theme**: Toggle between themes with persistence
- **Interactive Plot**: Navigate through data with sliding window
- **Video Player**: Watch animated progress visualizations
- **Export Functionality**: Generate self-contained HTML files

### 🎬 Video Generation Suite

#### 1. Legacy Version (`wordle_video_generator.py`)
**Classic, clean 2D visualization**
- ✅ Simple, readable design
- ✅ Light background theme
- ✅ GIF and MP4 export
- ✅ Compatible with all systems
- 📁 Size: ~0.3 MB (MP4)

#### 2. Modern 2D (`wordle_video_modern.py`)
**Enhanced 2D with dark theme and modern styling**
- 🎨 Dark theme with modern colors
- ✨ Enhanced line thickness and scatter points
- 🎯 Progress indicator in title
- 💫 Glow effects and better contrast
- 📁 Size: ~0.6 MB (MP4)
- **Sliding Window**: Shows 5-6 days for optimal viewing

#### 3. Modern 3D (`wordle_video_modern.py`)
**Rotating 3D visualization with user layers**
- 🌟 Full 3D visualization
- 🔄 Rotating camera view
- 📊 Users separated on Z-axis layers
- 🎭 Dramatic 3D effects
- 📁 Size: ~3.8 MB (MP4)

#### Video Features Comparison
| Feature | Legacy 2D | Modern 2D | Modern 3D |
|---------|-----------|-----------|-----------|
| Theme | Light | Dark | Dark |
| Dimensions | 2D | 2D | 3D |
| Animation | Static view | Sliding window | Rotating |
| User separation | Colors only | Colors + styling | Colors + Z-layers |
| File size | Smallest | Medium | Largest |
| Visual impact | Clean | Stylish | Dramatic |
| Processing time | Fastest | Fast | Slower |

### 💾 Database Management

#### Core Features
- **SQLite Backend**: Efficient local database storage
- **Data Validation**: Automatic score validation and cleanup
- **X/6 Score Handling**: Properly handles failed games as score 7
- **Backup System**: Automatic backup creation
- **Diagnostic Tools**: Health checks and data integrity verification

#### Statistics Calculated
1. **Average Score**: Lower is better (X counts as 7)
2. **Participation**: Total number of days played
3. **Score Consistency**: Lower variance = more consistent scoring
4. **Streak Consistency**: Measures how well someone maintains consecutive play days
5. **Longest Streak**: Maximum consecutive days played

---

## 🎛️ Advanced Usage

### Programmatic Usage

#### Web Application
```python
from src.web.wordle_stats_app import WordleStatsCalculator

# Initialize calculator
calculator = WordleStatsCalculator()

# Get all-time statistics
stats = calculator.get_all_time_stats()
rankings = calculator.get_rankings(stats)

# Get recent statistics
recent_stats = calculator.get_last_week_stats()

# Export HTML
from src.web.wordle_stats_app import export_comprehensive_html
export_comprehensive_html("my_export.html")
```

#### Video Generation
```python
# Legacy version
from src.video.wordle_video_generator import WordleVideoGenerator
legacy = WordleVideoGenerator()
legacy.create_animation("classic.mp4", fps=3, duration_per_day=0.3)

# Modern 2D (Recommended for web)
from src.video.wordle_video_modern import ModernWordleVideoGenerator
modern = ModernWordleVideoGenerator()
modern.create_modern_2d_animation("modern_2d.mp4", fps=4, duration_per_day=0.4)

# Modern 3D (Most impressive)
modern.create_modern_3d_animation("modern_3d.mp4", fps=4, duration_per_day=0.4)
```

#### Database Management
```python
from src.core.wordle_sqlite_tracker import WordleSQLiteTracker

tracker = WordleSQLiteTracker()

# Add new user
tracker.add_user("username")

# Add result (score, day)
tracker.add_result("username", 3, 150)  # score 3, day 150
tracker.add_result("username", "X", 151)  # failed game, day 151

# Get all users
users = tracker.get_all_users()

# Get user results
results = tracker.get_user_results("username")
```

### 🎨 Customization Options

#### Video Settings
- **FPS**: 2-6 recommended (higher = smoother)
- **Duration per day**: 0.2-0.5 seconds (lower = faster)
- **Format**: MP4 (smaller) or GIF (universal)

#### Web Theme Customization
Edit CSS variables in `src/web/wordle_stats_app.py` around line 428:
```css
:root {
    --bg-primary: #f8fafc;        /* Light theme background */
    --text-primary: #1f2937;      /* Light theme text */
    --wordle-primary: '#667eea';  /* Primary accent color */
}

[data-theme="dark"] {
    --bg-primary: #0f172a;        /* Dark theme background */
    --text-primary: #f1f5f9;      /* Dark theme text */
}
```

#### Video Color Palettes
Modify the color arrays in video generator files:
```python
# In wordle_video_modern.py
self.modern_colors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', 
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
]
```

---

## 🔧 Technical Requirements

### Essential Dependencies
- **Python 3.7+**
- **Flask** (for web application)
- **SQLite3** (built-in with Python)

### Video Generation Dependencies
```bash
pip install matplotlib numpy
```

### Optional (for MP4 export)
- **ffmpeg** (for smaller MP4 files instead of GIF)

### Installation Commands
```bash
# Basic setup
pip install flask

# Video generation
pip install matplotlib numpy

# Optional: Install ffmpeg for MP4 export
# macOS: brew install ffmpeg
# Ubuntu: sudo apt install ffmpeg
# Windows: Download from https://ffmpeg.org/
```

---

## 📊 Output Files and Recommendations

### 🎬 Video Recommendations

#### For Social Media
- **Modern 2D**: Best balance of style and file size
- **4 FPS, 0.3s per day**: Good pacing for viewing
- **MP4 format**: Smaller file size

#### For Presentations
- **Modern 3D**: Most impressive visual impact
- **3 FPS, 0.4s per day**: Allows time to read data
- **MP4 format**: Professional quality

#### For Email/Sharing
- **Legacy MP4**: Smallest file size, universal compatibility
- **5 FPS, 0.2s per day**: Quick overview
- **GIF format**: Universal compatibility (larger file)

### 📄 HTML Export Recommendations

#### Self-Contained Exports
- **Complete Export**: Includes all features (stats, plot, video)
- **File Size**: ~3.5 MB (with embedded video)
- **Compatibility**: Works offline on any modern browser
- **Features**: Mobile responsive, theme toggle, interactive elements

### 🗂️ File Organization
- **Videos**: Automatically saved to `media/` directory
- **Exports**: Automatically saved to `exports/` directory
- **Database**: Stored in `data/` directory
- **Backups**: Automatic backups created in `backups/`

---

## 🆘 Troubleshooting Guide

### Common Issues

#### 1. Database Not Found
```bash
# Make sure you're in the project root directory
pwd  # Should show .../wordle
python run_web_app.py  # Run from project root
```

#### 2. Video Generation Fails
```bash
# Install required dependencies
pip install matplotlib numpy

# Check if ffmpeg is available (optional)
ffmpeg -version
```

#### 3. Web App Template Errors
```bash
# Use convenience script instead of direct python call
python run_web_app.py  # Correct
# Instead of: cd src/web && python wordle_stats_app.py
```

#### 4. Export Path Issues
```bash
# Make sure exports directory exists
mkdir -p exports

# Use convenience script
python export.py my_file.html
```

#### 5. Port Already in Use
```bash
# Kill existing Flask processes
pkill -f "wordle_stats_app.py"
# Or change port in run_web_app.py
```

### 🔍 Debug Mode

#### Enable Detailed Logging
```python
# In wordle_stats_app.py
app.run(debug=True, port=12001)  # Already enabled
```

#### Database Diagnostics
```bash
cd src/core
python diagnose_database.py  # Comprehensive health check
python show_day.py recent    # View recent data
```

---

## 🎯 Best Practices

### 📈 Data Management
1. **Regular Backups**: Database is automatically backed up
2. **Data Validation**: Use built-in validation when adding scores
3. **Consistent Scoring**: X/6 failures are automatically handled as score 7

### 🚀 Performance Tips
1. **Video Generation**: Start with Modern 2D for best balance
2. **Web Access**: Use local network IP for team access
3. **Export Sharing**: HTML exports work offline anywhere

### 🎨 Visual Guidelines
1. **Theme Consistency**: Dark theme works best for videos and exports
2. **Color Accessibility**: Built-in colors are high-contrast
3. **Mobile First**: Interface is optimized for mobile viewing

---

## 🤝 Contributing and Extending

### Adding New Features
1. **Database Schema**: Extend `wordle_sqlite_tracker.py`
2. **Web Interface**: Add templates to `src/web/templates/`
3. **Video Styles**: Create new animation methods
4. **Statistics**: Add new ranking calculations

### Code Organization
1. **Keep Structure**: Maintain the organized directory structure
2. **Update Paths**: Use relative paths for cross-platform compatibility
3. **Test Everything**: Run web app, export, and video generation
4. **Document Changes**: Update this README for new features

### 📝 Development Guidelines
- Follow the established file organization
- Test on both desktop and mobile
- Maintain backward compatibility
- Use descriptive variable names
- Add error handling for user inputs

---

## 📋 Complete File Reference

### Core Python Files
- `src/core/wordle_sqlite_tracker.py` - Main database tracking class (521 lines)
- `src/core/clear_database.py` - Database clearing utility
- `src/core/diagnose_database.py` - Database health diagnostics
- `src/core/show_day.py` - View specific day data

### Web Application Files
- `src/web/wordle_stats_app.py` - Flask application with statistics (1360 lines)
- `src/web/templates/stats.html` - Main statistics page
- `src/web/templates/plot.html` - Interactive plot interface  
- `src/web/templates/video.html` - Video player page

### Video Generation Files
- `src/video/wordle_video_generator.py` - Legacy video generator (279 lines)
- `src/video/wordle_video_modern.py` - Modern video generator with 3D (782 lines)

### Convenience Scripts
- `run_web_app.py` - Start web application from any directory
- `export.py` - Generate HTML exports from any directory
- `generate_video.py` - Interactive video generation menu

### Data Files
- `data/wordle_database.db` - SQLite database with all game data
- `media/*.mp4` - Generated video files
- `exports/*.html` - Self-contained HTML exports

---

**Enjoy tracking and visualizing your group's Wordle performance! 🎯**

*This comprehensive system provides everything needed to analyze, visualize, and share your Wordle group's gaming journey with professional-quality outputs and an intuitive interface.*