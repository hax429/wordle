# 🎯 COMPLETE GUIDE - Everything You Need

## 📦 What You Have

A production-ready Wordle statistics web application with:
- ✅ Node.js backend (no Python needed!)
- ✅ Beautiful responsive frontend
- ✅ Standalone video generation
- ✅ Secure admin console
- ✅ Ready for GitHub
- ✅ Ready for deployment

## 🚀 Getting Started (Choose Your Path)

### Path 1: Quick Test (2 minutes)

```bash
npm install
npm run setup
npm start
```

Open http://localhost:3000 - **Done!**

### Path 2: Production Deploy (30 minutes)

1. Upload to your Oracle Linux server
2. Follow steps in DEPLOYMENT.md
3. Configure nginx + SSL
4. Share with the world!

### Path 3: GitHub Upload (5 minutes)

```bash
cd wordle-web
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/yourusername/wordle-stats-web.git
git push -u origin main
```

## 📁 Project Structure Explained

```
wordle-web/
├── server/              ← Backend (Node.js)
│   ├── index.js        ← Main server file
│   ├── database.js     ← Database operations
│   ├── setup.js        ← Setup wizard
│   ├── routes/         ← API endpoints
│   ├── middleware/     ← Authentication
│   └── utils/          ← Helpers (parser, stats, video)
│
├── public/              ← Frontend (Browser)
│   ├── index.html      ← Public page
│   ├── admin.html      ← Admin console
│   ├── css/            ← Styles
│   └── js/             ← JavaScript
│
├── data/                ← Database storage
├── videos/              ← Generated videos
├── backups/             ← Database backups
├── deploy/              ← Server configs
│
└── Documentation
    ├── README.md        ← Main docs (comprehensive)
    ├── START_GUIDE.md   ← Beginner guide
    ├── DEPLOYMENT.md    ← Server deployment
    ├── CONTRIBUTING.md  ← How to contribute
    └── PROJECT_SUMMARY.md ← Quick overview
```

## 🎯 Core Features

### Public View (Guest Access - No Login)
When you open http://localhost:3000:

1. **Statistics Dashboard**
   - Total days tracked
   - Number of players
   - Total games played
   - Average games per player

2. **Rankings & Leaderboards**
   - Best Average Score (lower is better)
   - Most Active Players (participation)
   - Longest Streaks (consecutive days)

3. **Interactive Charts**
   - Plotly.js powered visualization
   - Shows all players' scores over time
   - Hover for details
   - Zoom and pan
   - Lower on chart = better score

4. **Progress Videos**
   - Animated visualization
   - Shows score progression
   - Color-coded by player
   - Shareable MP4 format

5. **Time Periods**
   - Toggle between "All Time" and "Last 7 Days"
   - Instant updates

### Admin Console (Password Protected)
When you open http://localhost:3000/admin:

1. **Login Screen**
   - Secure password entry
   - JWT token authentication
   - 24-hour session

2. **Database Overview**
   - Total days, users, entries
   - Day range (min to max)
   - System health

3. **Import Data**
   - Paste Wordle streak messages
   - Auto-parses users, scores, winners
   - Instant confirmation
   - Updates statistics immediately

4. **Manage Days**
   - View list of all tracked days
   - View specific day details
   - Delete individual days
   - Bulk operations

5. **Generate Videos**
   - 2D Animation (recommended)
   - 3D Animation (future enhancement)
   - Custom filenames
   - Progress tracking
   - Automatic publishing to public view

6. **Database Actions**
   - Download backup (SQLite .db file)
   - Clear entire database (with confirmation)
   - Export data

## 💻 Technical Implementation

### Backend (Node.js)

**server/index.js** - Express Application
- Serves static files
- Mounts API routes
- Handles authentication
- Error handling
- Health checks

**server/database.js** - Database Layer
- SQLite operations
- Transaction support
- CRUD methods
- Query optimization

**server/routes/guest.js** - Public API
- Statistics endpoints
- Chart data
- Video streaming
- No authentication required

**server/routes/admin.js** - Admin API
- Protected endpoints
- Data import
- Day management
- Video generation
- Backup download

**server/middleware/auth.js** - Security
- Password hashing (bcrypt)
- JWT generation/verification
- Token validation

**server/utils/parser.js** - Message Parser
- Regex-based parsing
- Handles emojis, crowns
- Username extraction
- Error handling

**server/utils/stats.js** - Statistics Engine
- All-time stats
- Weekly stats
- Rankings generation
- Consistency calculations
- Streak analysis

**server/utils/video.js** - Video Generator
- Canvas-based frame generation
- ffmpeg encoding
- Sliding window visualization
- Color-coded users
- Dark theme with high contrast

### Frontend (Vanilla JavaScript)

**public/index.html** - Guest View Structure
- Semantic HTML5
- Accessible markup
- Mobile-first layout
- CDN libraries (Plotly, Chart.js)

**public/admin.html** - Admin Console Structure
- Login form
- Dashboard sections
- Form inputs
- Confirmation dialogs

**public/css/styles.css** - Responsive Styles
- CSS Variables for theming
- Flexbox and Grid layouts
- Mobile breakpoints (< 768px)
- Tablet breakpoints (768-1024px)
- Desktop optimized (> 1024px)
- Smooth transitions
- Dark theme

**public/js/guest.js** - Public Page Logic
- Fetch statistics from API
- Render overview cards
- Generate rankings
- Initialize charts
- Handle video player
- Error handling
- Loading states

**public/js/admin.js** - Admin Console Logic
- Login flow
- JWT token management
- Protected API calls
- Form submissions
- Day management
- Video generation
- Backup download
- Notifications

**public/js/charts.js** - Visualization
- Plotly configuration
- Chart.js setup
- Color palette
- Responsive sizing
- Interactive features

## 🔒 Security Implementation

### Password Security
```javascript
// Hashing (bcrypt with 10 rounds)
const hash = await bcrypt.hash(password, 10);

// Verification
const isValid = await bcrypt.compare(password, hash);
```

### JWT Authentication
```javascript
// Token generation
const token = jwt.sign(
    { role: 'admin', timestamp: Date.now() },
    JWT_SECRET,
    { expiresIn: '24h' }
);

// Token verification
const decoded = jwt.verify(token, JWT_SECRET);
```

### Rate Limiting
```javascript
// 5 login attempts per 15 minutes
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5
});
```

### SQL Injection Prevention
```javascript
// Always use parameterized queries
db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
```

## 📊 Database Schema Explained

### Users Table
```sql
CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,     -- Player name (supports emojis!)
    first_seen TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Streaks Table
```sql
CREATE TABLE streaks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    day INTEGER UNIQUE NOT NULL,       -- Day number (1, 2, 3...)
    imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
)
```

### Results Table
```sql
CREATE TABLE results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    streak_day INTEGER NOT NULL,       -- Which day
    user_id INTEGER NOT NULL,          -- Which user
    score TEXT NOT NULL,               -- Score (1-6 or X)
    is_winner BOOLEAN DEFAULT 0,       -- Daily winner (👑)
    FOREIGN KEY (streak_day) REFERENCES streaks(day),
    FOREIGN KEY (user_id) REFERENCES users(id),
    UNIQUE(streak_day, user_id)       -- One score per user per day
)
```

## 🎬 Video Generation Explained

### How It Works

1. **Data Extraction**
   - Query all user scores from database
   - Organize by day and user
   - Calculate window size

2. **Frame Generation** (using Canvas)
   - Create 1920x1080 PNG for each day
   - Draw background (dark theme)
   - Draw axes and grid
   - Plot user score lines
   - Add legends and labels
   - Apply colors per user

3. **Video Encoding** (using ffmpeg)
   - Combine PNG frames into MP4
   - H.264 codec for compatibility
   - 3 FPS for smooth animation
   - Optimized file size

4. **Publishing**
   - Save to `videos/` directory
   - Accessible via `/api/videos/:filename`
   - Automatically shown on public page

### Customization

```javascript
// In server/utils/video.js
const options = {
    fps: 3,              // Frames per second
    windowSize: 6,       // Days visible at once
    width: 1920,         // Resolution
    height: 1080
};
```

## 🌐 API Endpoints Reference

### Public Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/` | Serve public view |
| GET | `/api/stats/all-time` | All-time statistics |
| GET | `/api/stats/last-week` | Last 7 days stats |
| GET | `/api/plot-data` | Chart data |
| GET | `/api/overview` | Database overview |
| GET | `/api/day/:day` | Specific day details |
| GET | `/api/days` | List all days |
| GET | `/api/videos` | List videos |
| GET | `/api/videos/:filename` | Stream video |
| GET | `/health` | Health check |

### Admin Endpoints (Require JWT)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/admin` | Serve admin console |
| POST | `/api/admin/login` | Authenticate |
| GET | `/api/admin/verify` | Verify token |
| POST | `/api/admin/import` | Import data |
| GET | `/api/admin/days` | List days |
| GET | `/api/admin/day/:day` | Day details |
| DELETE | `/api/admin/day/:day` | Delete day |
| POST | `/api/admin/clear` | Clear database |
| GET | `/api/admin/database-info` | DB info |
| POST | `/api/admin/video/generate` | Generate video |
| GET | `/api/admin/backup` | Download backup |

## 📱 Responsive Design Breakdown

### Mobile (< 768px)
- Single column layout
- Stacked statistics cards
- Full-width charts
- Touch-friendly buttons
- Collapsible sections
- Optimized font sizes

### Tablet (768px - 1024px)
- 2 column grid
- Side-by-side rankings
- Larger charts
- Comfortable spacing

### Desktop (> 1024px)
- 3-4 column grid
- Maximum information density
- Large interactive charts
- Hover effects
- Detailed tooltips

## 🔄 Data Flow

```
User Chat Message
    ↓
Copy & Paste to Admin Console
    ↓
POST /api/admin/import
    ↓
server/utils/parser.js (parse message)
    ↓
server/database.js (save to SQLite)
    ↓
Response: Success + summary
    ↓
Frontend: Reload dashboard
    ↓
Public View: Updated automatically
```

## 🎨 Color Scheme

20 distinct colors for user identification:
```javascript
'#FF4444', '#00FF88', '#4488FF', '#FFBB00', // Red, Green, Blue, Yellow
'#FF8844', '#BB44FF', '#00FFFF', '#FF44BB', // Orange, Purple, Cyan, Magenta
// ... 12 more vibrant colors
```

## 🚀 Deployment Scenarios

### Scenario 1: Personal Use (Local)
```bash
npm start
# Access at http://localhost:3000
# Perfect for personal tracking
```

### Scenario 2: Small Group (Local Network)
```bash
npm start
# Share http://YOUR_IP:3000 with friends on same WiFi
# Great for office or home groups
```

### Scenario 3: Internet Access (Production)
```bash
# Deploy to VPS (Oracle Linux, Ubuntu, etc.)
# Configure nginx + SSL
# Share https://yourdomain.com
# Perfect for distributed groups
```

### Scenario 4: Cloud Platform
```bash
# Deploy to Heroku, AWS, DigitalOcean
# Use managed database if needed
# Scale as needed
```

## 🎓 Complete Feature List

### Data Management
- [x] Import Wordle streak messages
- [x] Parse users, scores, winners
- [x] Store in SQLite database
- [x] Update statistics in real-time
- [x] View individual days
- [x] Delete individual days
- [x] Clear entire database
- [x] Backup and restore

### Statistics
- [x] All-time averages
- [x] Weekly averages
- [x] Participation rates
- [x] Win tracking
- [x] Consistency scores
- [x] Streak analysis
- [x] Score distribution

### Rankings
- [x] Best average score
- [x] Most active players
- [x] Longest consecutive streaks
- [x] Most consistent players
- [x] Score consistency

### Visualizations
- [x] Real-time overview dashboard
- [x] Interactive Plotly charts
- [x] Sliding window view
- [x] Animated progress videos
- [x] Color-coded user tracking
- [x] Responsive charts

### Admin Features
- [x] Secure authentication (JWT + bcrypt)
- [x] Data import interface
- [x] Day management
- [x] Video generation
- [x] Database backup
- [x] System monitoring

### UI/UX
- [x] Mobile responsive
- [x] Tablet optimized
- [x] Desktop enhanced
- [x] Loading states
- [x] Error handling
- [x] Success notifications
- [x] Smooth transitions

## 📈 Statistics Calculations Explained

### Average Score
```javascript
// Lower is better (1 = perfect, 7 = failed)
average = sum(scores) / count(scores)
```

### Participation Rate
```javascript
// Percentage of days played
rate = days_participated / total_days_available
```

### Longest Streak
```javascript
// Most consecutive days played
// Example: [1,2,3,5,6,7,8] → streak = 4 (days 5-8)
```

### Consistency Score
```javascript
// How regular is participation (0-1, higher is better)
consistency = 1 / (1 + average_gap_between_games)
```

### Score Variance
```javascript
// Lower = more consistent scores
variance = average((score - mean)²)
```

## 🔧 Configuration Options

### Environment Variables (.env)

```env
# Required
NODE_ENV=production
PORT=3000
DATABASE_PATH=./data/wordle.db
ADMIN_PASSWORD_HASH=<generated>
JWT_SECRET=<generated>

# Optional
VIDEO_PATH=./videos
```

### Runtime Options

```bash
# Custom port
PORT=8080 npm start

# Development mode
NODE_ENV=development npm start

# Debug logging
DEBUG=* npm start
```

## 🧪 Testing Your Installation

### 1. Health Check
```bash
curl http://localhost:3000/health
```

Expected:
```json
{
  "status": "healthy",
  "database": "connected",
  "stats": { "days": 0, "users": 0, "entries": 0 }
}
```

### 2. Import Test Data
```bash
curl -X POST http://localhost:3000/api/admin/login \
  -H "Content-Type: application/json" \
  -d '{"password":"your_password"}'
# Copy the token from response

curl -X POST http://localhost:3000/api/admin/import \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"message":"1 day streak\n1/6: @testuser"}'
```

### 3. View Statistics
```bash
curl http://localhost:3000/api/overview
```

Should show 1 day, 1 user, 1 entry.

### 4. Test Web Interface
- Open http://localhost:3000
- Click refresh
- See test data appear
- Test on mobile (open same URL on phone)

## 📱 Mobile Testing

### On Real Device

1. Find your computer's IP:
   ```bash
   # macOS
   ifconfig | grep "inet " | grep -v 127.0.0.1
   
   # Linux
   hostname -I
   
   # Look for: 192.168.1.XXX
   ```

2. On phone, open browser to:
   ```
   http://192.168.1.XXX:3000
   ```

3. Test all features:
   - Statistics display
   - Charts resize properly
   - Buttons are tap-friendly
   - Text is readable
   - Navigation works

### Using Browser Dev Tools

1. Open http://localhost:3000
2. Press F12 (open dev tools)
3. Click device toolbar icon (or Ctrl+Shift+M)
4. Select iPhone, iPad, or custom size
5. Test interface at different sizes

## 🎬 Video Generation Process

### What Happens When You Click "Generate Video"

1. **API Call**: Frontend → POST /api/admin/video/generate
2. **Validation**: Server validates token and parameters
3. **Data Extraction**: Query database for all user scores
4. **Frame Generation**: 
   - Create Canvas (1920x1080)
   - Draw background, grid, axes
   - Plot user scores as lines
   - Add legend and labels
   - Save as PNG
   - Repeat for each day
5. **Video Encoding**:
   - Feed PNGs to ffmpeg
   - Encode as H.264 MP4
   - Optimize file size
6. **Cleanup**: Delete temporary PNG files
7. **Response**: Return video URL
8. **Frontend**: Show success message

### Requirements

- **ffmpeg**: Must be installed on system
- **Disk Space**: ~100MB temp for large datasets
- **Processing Time**: ~1-3 minutes for 100 days

## 🚀 GitHub Upload Steps

### 1. Initialize Git

```bash
cd wordle-web
git init
```

### 2. Create .gitignore (already created!)

The `.gitignore` file ensures sensitive data isn't committed:
- ✅ `.env` (passwords!)
- ✅ `node_modules/`
- ✅ `data/*.db` (user data)
- ✅ `backups/`
- ✅ `videos/`

### 3. Initial Commit

```bash
git add .
git commit -m "Initial commit: Wordle Stats Web v1.0.0"
```

### 4. Create GitHub Repository

1. Go to https://github.com/new
2. Repository name: `wordle-stats-web`
3. Description: "Track Wordle group statistics with web interface"
4. Public or Private: Your choice
5. Don't initialize with README (we have one!)
6. Click "Create repository"

### 5. Push to GitHub

```bash
git remote add origin https://github.com/YOUR_USERNAME/wordle-stats-web.git
git branch -M main
git push -u origin main
```

### 6. Configure GitHub

Add these topics:
- wordle
- statistics
- tracker
- nodejs
- express
- sqlite
- visualization

### 7. Share!

Your repository is now public at:
```
https://github.com/YOUR_USERNAME/wordle-stats-web
```

## 📋 Pre-Upload Checklist

Before uploading to GitHub:

- [x] All code files created
- [x] Documentation complete
- [x] .gitignore configured
- [x] No sensitive data in code
- [x] LICENSE file included (MIT)
- [x] README.md is comprehensive
- [x] Example .env included (env.example)
- [x] Database file excluded (.gitignore)
- [x] node_modules excluded (.gitignore)
- [x] Contributing guidelines added
- [x] Issue templates created
- [x] GitHub Actions workflow added

✅ **Everything is ready for GitHub!**

## 🎉 What You've Accomplished

You now have:

1. **Full-Stack Web Application**
   - Modern Node.js backend
   - Beautiful responsive frontend
   - Production-ready code

2. **Complete Feature Set**
   - Statistics tracking
   - Data visualization
   - Video generation
   - Admin management

3. **Production Ready**
   - Security implemented
   - Deployment configs included
   - Documentation complete

4. **GitHub Ready**
   - Clean repository structure
   - Comprehensive README
   - Contributing guidelines
   - Issue templates

5. **Deployment Ready**
   - nginx configuration
   - systemd service file
   - PM2 configuration
   - SSL ready

## 🎯 Final Commands

### To Run Locally

```bash
cd wordle-web
npm install
npm run setup
npm start
```

### To Deploy to Server

```bash
# See DEPLOYMENT.md for full guide
scp -r wordle-web/* server:/opt/wordle/
ssh server
cd /opt/wordle
npm install --production
npm run setup
# Configure nginx and systemd (see DEPLOYMENT.md)
```

### To Upload to GitHub

```bash
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/YOU/wordle-stats-web.git
git push -u origin main
```

---

## 🌟 You're Done!

**Congratulations!** You have a complete, professional-grade Wordle statistics web application ready to:

- ✅ Run locally
- ✅ Deploy to production
- ✅ Share on GitHub
- ✅ Use with your group
- ✅ Customize and extend

**Questions?** Check the other docs:
- General info: README.md
- Server setup: DEPLOYMENT.md
- Contributing: CONTRIBUTING.md
- Quick overview: PROJECT_SUMMARY.md

**Enjoy tracking your Wordle games!** 🎯📊🏆

---

Made with ❤️ for Wordle enthusiasts
