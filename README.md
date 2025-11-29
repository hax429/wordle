# Wordle Stats Web 🎯

A beautiful web app for tracking Wordle group statistics with animated effects, interactive charts, and custom video player controls.

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![Node](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen.svg)

---

## 🚀 Quick Start

### Prerequisites
- **Node.js 16+** - [Download here](https://nodejs.org/)
- **ffmpeg** (optional, for video generation)
  ```bash
  # Oracle Linux/RHEL
  sudo dnf install ffmpeg

  # Ubuntu/Debian
  sudo apt-get install ffmpeg

  # macOS
  brew install ffmpeg
  ```

### Installation & Setup

```bash
cd /home/opc/services/wordle

# Install dependencies
npm install

# Run setup wizard (if needed)
npm run setup

# Start the server
npm start
```

### Access the App

- **Public View**: http://localhost:3001
- **Admin Console**: http://localhost:3001/admin
- **Health Check**: http://localhost:3001/health

**Default Admin Password:** `admin123` ⚠️ **Change this immediately!**

---

## ✨ Features

### 🎨 Visual Effects
- Animated particle background with connecting lines
- Confetti celebrations on page load
- Smooth card animations with stagger effects
- Shimmer effects on medal badges
- Gradient animations on header
- Pulsing statistics numbers

### 🎬 Custom Video Player
- Beautiful circular play/pause button overlay
- Progress bar with seek functionality
- Mobile-optimized touch controls
- Auto-hide controls during playback

### 📊 Public Dashboard
- Real-time statistics and rankings
- Interactive charts (Plotly.js)
- Best average scores, most active players, longest streaks
- Fully responsive design

### 🔒 Admin Features
- Secure JWT authentication
- Import Wordle data from group messages
- Generate animated progress videos
- Day management (view, delete specific days)
- Database backup/restore
- System health monitoring

---

## 📥 How to Import Data

1. **Copy a Wordle message** from your group chat:
   ```
   100 day streak
   👑 1/6: @alice
   2/6: @bob @charlie
   3/6: @david
   X/6: @eve
   ```

2. **Go to Admin Console**: http://localhost:3001/admin

3. **Login** with your password

4. **Paste the message** in the Import Data section

5. **Click "Import Data"**

6. **View your stats** at http://localhost:3001

---

## 🔑 Password Management

### Reset Admin Password

**Method 1 - Setup Wizard (Recommended):**
```bash
cd /home/opc/services/wordle
npm run setup
# Follow prompts, choose to overwrite .env
```

**Method 2 - Reset Script:**
```bash
node reset-password.js
# Enter new password
```

**Method 3 - Manual:**
```bash
node -e "const bcrypt = require('bcrypt'); bcrypt.hash('YOUR_NEW_PASSWORD', 10).then(hash => console.log('ADMIN_PASSWORD_HASH=' + hash));"
# Copy the hash to .env file, then restart server
```

---

## 🐛 Common Issues

### Port Already in Use
```bash
# Find and kill the process
lsof -i :3001
kill -9 <PID>

# Or use different port
PORT=3002 npm start
```

### Database Locked
```bash
pkill -f "node server/index.js"
rm data/wordle_database.db-shm data/wordle_database.db-wal 2>/dev/null
npm start
```

### Forgot Password
```bash
npm run setup
# Or
node reset-password.js
```

### ffmpeg Not Found
```bash
sudo dnf install ffmpeg  # Oracle Linux
```

---

## 📁 Project Structure

```
wordle/
├── server/              # Backend (Node.js + Express)
│   ├── index.js        # Main server
│   ├── database.js     # SQLite operations
│   ├── routes/         # API endpoints
│   └── utils/          # Parsers, stats, video generation
│
├── public/             # Frontend (Vanilla JS)
│   ├── index.html      # Public view
│   ├── admin.html      # Admin console
│   ├── css/styles.css  # Styles + animations
│   └── js/             # Client-side logic
│
├── data/               # Database
│   └── wordle_database.db
│
├── videos/             # Generated videos
├── backups/            # Database backups
└── .env               # Configuration
```

---

## 🛠️ Tech Stack

**Backend:** Node.js, Express, SQLite3, bcrypt, JWT, Canvas, ffmpeg
**Frontend:** Vanilla JavaScript, Plotly.js, Chart.js, CSS3 animations
**Database:** SQLite3 (wordle_database.db)

---

## 💾 Backup & Restore

### Create Backup
```bash
# Via admin console
# Click "Download Backup" button

# Via command line
cp data/wordle_database.db backups/backup_$(date +%Y%m%d).db
```

### Restore Backup
```bash
# Stop server
pkill -f "node server/index.js"

# Restore
cp backups/backup_20241018.db data/wordle_database.db

# Restart
npm start
```

---

## 🌐 Production Deployment

### Quick Deployment (Oracle Linux)

```bash
# 1. Install dependencies
sudo dnf install -y nodejs nginx ffmpeg

# 2. Configure systemd service
sudo nano /etc/systemd/system/wordle.service
```

```ini
[Unit]
Description=Wordle Stats Web
After=network.target

[Service]
Type=simple
User=opc
WorkingDirectory=/home/opc/services/wordle
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
EnvironmentFile=/home/opc/services/wordle/.env

[Install]
WantedBy=multi-user.target
```

```bash
# 3. Start service
sudo systemctl daemon-reload
sudo systemctl enable wordle
sudo systemctl start wordle

# 4. Open firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --reload
```

### SSL Setup (Optional)
```bash
sudo dnf install -y epel-release certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com
```

---

## 📊 Database Info

**Database File:** `data/wordle_database.db` (SQLite3)

**Schema:**
- `users` - Player information
- `streaks` - Day tracking
- `results` - Individual scores per day

---

## 🎨 Customization

### Change Colors
Edit `public/css/styles.css`:
```css
:root {
    --primary-color: #667eea;  /* Your color */
    --secondary-color: #764ba2; /* Your color */
}
```

### Disable Confetti
Edit `public/js/guest.js` - Remove lines 647-649:
```javascript
// setTimeout(() => {
//     GuestApp.triggerConfetti();
// }, 1000);
```

---

## 📋 Quick Commands

```bash
# Start server
npm start

# Reset password
npm run setup

# View logs (systemd)
sudo journalctl -u wordle -f

# Backup database
cp data/wordle_database.db backups/backup_$(date +%Y%m%d).db

# Health check
curl http://localhost:3001/health
```

---

## 📖 API Endpoints

### Public
- `GET /` - Public view
- `GET /api/stats/all-time` - All-time stats
- `GET /api/stats/last-week` - Last 7 days stats
- `GET /api/plot-data` - Chart data
- `GET /api/videos` - List videos
- `GET /health` - Health check

### Admin (Requires JWT)
- `POST /api/admin/login` - Login
- `POST /api/admin/import` - Import data
- `POST /api/admin/video/generate` - Generate video
- `GET /api/admin/backup` - Download backup
- `DELETE /api/admin/day/:day` - Delete day

---

## 🌟 Browser Support

✅ Chrome 90+
✅ Firefox 88+
✅ Safari 14+
✅ Edge 90+
✅ Mobile Safari/Chrome

---

## 📄 License

MIT License

---

**Made with ❤️ for Wordle enthusiasts**

**Current Status:**
- Database: `wordle_database.db`
- Port: `3001`
- Admin Password: `admin123` (change immediately!)

Get started: `npm start` → http://localhost:3001 🎯✨
