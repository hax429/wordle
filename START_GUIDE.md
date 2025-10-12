# 🚀 Complete Start Guide

Welcome! This guide will get you from zero to running in under 10 minutes.

## 📋 What You're Building

A complete web application that:
- Tracks your Wordle group's daily scores
- Shows beautiful statistics and rankings
- Creates animated progress videos
- Works on mobile and desktop
- Has a secure admin console for management

## 🎯 Quick Start Path

### Path A: Just Want to Try It? (5 minutes)

```bash
cd wordle-web
npm install
npm run setup    # Follow prompts to set password
npm start        # Server starts immediately
```

Open http://localhost:3000 - **You're live!**

### Path B: Want to Deploy to Production? (30 minutes)

Follow the [Production Deployment](#production-deployment) section below.

## 📦 Step-by-Step Installation

### Step 1: System Requirements

**Check Node.js:**
```bash
node --version  # Should be 16.0.0 or higher
```

Don't have Node.js? Install it:
- **macOS**: `brew install node`
- **Ubuntu**: `sudo apt install nodejs npm`
- **Oracle Linux**: `sudo dnf install nodejs`
- **Windows**: Download from [nodejs.org](https://nodejs.org/)

**Install ffmpeg (for video generation):**
```bash
# macOS
brew install ffmpeg

# Ubuntu/Debian
sudo apt-get install ffmpeg

# Oracle Linux/RHEL
sudo dnf install ffmpeg

# Windows
# Download from https://ffmpeg.org/
```

### Step 2: Install Dependencies

```bash
cd wordle-web
npm install
```

This installs:
- Express (web server)
- better-sqlite3 (database)
- bcrypt (password security)
- jsonwebtoken (authentication)
- canvas (video generation)
- and more...

### Step 3: Run Setup Wizard

```bash
npm run setup
```

**You'll be asked:**

1. **Admin password**: Choose a strong password (min 6 characters)
   - Example: `MySecurePassword123!`
   - This is for the admin console only

2. **Confirm password**: Type it again
   - Must match exactly

3. **Server port**: Press Enter for default (3000)
   - Or choose custom port (e.g., 8080)

**Setup creates:**
- ✅ `.env` file with your configuration
- ✅ Secure password hash
- ✅ Random JWT secret
- ✅ `data/`, `videos/`, `backups/` directories
- ✅ Empty database (ready for data)

### Step 4: Start the Server

```bash
npm start
```

**Success looks like:**
```
🎯 Wordle Stats Server running on port 3000
📊 Public view: http://localhost:3000
🔒 Admin console: http://localhost:3000/admin
💚 Health check: http://localhost:3000/health

📈 Database Overview:
   • 0 days
   • 0 users
   • 0 entries
```

**Troubleshooting:**
- Port in use? Run `PORT=3001 npm start`
- Errors? Check you ran `npm install` first
- Database errors? Delete `data/wordle.db` and restart

### Step 5: Access the Application

Open your browser to:

**Public View**: http://localhost:3000
- No login required
- See statistics, charts, videos
- Share this URL with friends

**Admin Console**: http://localhost:3000/admin
- Login with your password
- Manage data, generate videos
- Keep this password private!

## 📥 Import Your First Data

### Step 1: Get a Wordle Streak Message

From your group chat, copy a message like:
```
100 day streak
👑 1/6: @alice
2/6: @bob @charlie
3/6: @david
X/6: @eve
```

### Step 2: Login to Admin

1. Go to http://localhost:3000/admin
2. Enter your admin password
3. Click "Login"

### Step 3: Import Data

1. Find the "Import Data" section
2. Paste your message in the text area
3. Click "Import Data"
4. See confirmation: "Successfully imported Day 100 with 5 entries"

### Step 4: View Your Stats

1. Go back to http://localhost:3000 (or click "Public View")
2. See your data in beautiful charts and tables!

## 🎬 Generate Your First Video

1. Login to admin console
2. Find "Generate Video" section
3. Select "Modern 2D Animation"
4. Click "Generate Video"
5. Wait 2-3 minutes (watch server console for progress)
6. Video appears on public page automatically!

**Note**: First video generation may take longer as dependencies initialize.

## 🌐 Share with Your Group

### Local Network Sharing

Find your local IP:
```bash
# macOS/Linux
ifconfig | grep "inet "

# Look for something like: inet 192.168.1.100
```

Share this URL with friends on same network:
```
http://192.168.1.100:3000
```

### Internet Sharing (Production)

See [Production Deployment](#production-deployment) below.

## 🖥️ Production Deployment

### Quick Deploy (Oracle Linux)

```bash
# 1. Install Node.js and nginx
sudo dnf install -y nodejs nginx ffmpeg

# 2. Create user and directory
sudo useradd -r -d /opt/wordle wordle
sudo mkdir -p /opt/wordle
sudo chown wordle:wordle /opt/wordle

# 3. Upload files
scp -r wordle-web/* user@server:/tmp/
sudo mv /tmp/wordle-web/* /opt/wordle/
sudo chown -R wordle:wordle /opt/wordle

# 4. Install dependencies
cd /opt/wordle
sudo -u wordle npm install --production

# 5. Run setup
sudo -u wordle npm run setup

# 6. Create systemd service
sudo cp deploy/wordle.service /etc/systemd/system/
sudo nano /etc/systemd/system/wordle.service
# Update WorkingDirectory to /opt/wordle
# Update EnvironmentFile to /opt/wordle/.env

sudo systemctl daemon-reload
sudo systemctl enable wordle
sudo systemctl start wordle

# 7. Configure nginx
sudo cp deploy/nginx.conf /etc/nginx/conf.d/wordle.conf
sudo nano /etc/nginx/conf.d/wordle.conf
# Update server_name to your domain
# Update paths as needed

sudo nginx -t
sudo systemctl reload nginx

# 8. Configure firewall
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# 9. Setup SSL (free with Let's Encrypt)
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com

# 10. Done!
# Access at https://your-domain.com
```

For detailed deployment guide, see **DEPLOYMENT.md**.

## 💡 Usage Tips

### Daily Workflow

**Morning Routine:**
1. Someone shares yesterday's Wordle results in group chat
2. Admin copies the message
3. Pastes into admin console
4. Clicks "Import Data"
5. Everyone can see updated stats immediately!

### Weekly Routine

1. Check "Last 7 Days" stats
2. See who's improving or slipping
3. Generate new progress video
4. Share video link with group

### Monthly Routine

1. Generate fresh video showing full progress
2. Download database backup
3. Review all-time rankings
4. Celebrate achievements!

## 🎨 Customization

### Change Port

Edit `.env`:
```env
PORT=8080
```

Or run directly:
```bash
PORT=8080 npm start
```

### Change Colors

Edit `server/utils/video.js` and `public/js/charts.js`:
```javascript
this.colors = [
    '#YOUR_COLOR_1',
    '#YOUR_COLOR_2',
    // ...
];
```

### Modify UI

- **Layout**: Edit `public/index.html`
- **Styles**: Edit `public/css/styles.css`
- **Behavior**: Edit `public/js/guest.js`

## 🔐 Security Best Practices

1. **Strong Password**: Use 12+ characters with mix of types
2. **HTTPS Only**: Always use SSL in production
3. **Regular Backups**: Daily automated backups
4. **Update Dependencies**: Run `npm update` monthly
5. **Monitor Logs**: Check for suspicious activity
6. **Keep .env Private**: Never commit to version control

## 🆘 Common Issues & Solutions

### "Port 3000 already in use"

**Solution:**
```bash
# Option 1: Kill existing process
lsof -i :3000
kill -9 <PID>

# Option 2: Use different port
PORT=3001 npm start
```

### "Cannot find module 'better-sqlite3'"

**Solution:**
```bash
npm install
# Make sure it completes without errors
```

### "ffmpeg: command not found"

**Solution:**
```bash
# Install ffmpeg (see Step 1 above)
brew install ffmpeg  # macOS
```

### "Unauthorized" when accessing admin

**Solution:**
- Clear browser local storage
- Login again
- Check .env file exists
- Verify ADMIN_PASSWORD_HASH is set

### Charts not showing

**Solution:**
- Check browser console (F12)
- Verify internet connection (needs CDN access)
- Check if data exists in database
- Try refreshing page

### Database is empty

**Solution:**
1. Import some data via admin console
2. Check import was successful
3. Verify database file exists: `ls -la data/wordle.db`

## 📚 Learning Resources

### Understanding the Code

**Backend Flow:**
1. `server/index.js` - Entry point, sets up Express
2. `server/database.js` - Handles all database operations
3. `server/routes/*` - Define API endpoints
4. `server/utils/*` - Helper functions

**Frontend Flow:**
1. `public/index.html` - Page structure
2. `public/js/guest.js` - Fetches data, renders UI
3. `public/js/charts.js` - Creates visualizations
4. `public/css/styles.css` - Makes it beautiful

**Data Flow:**
```
User Action → Frontend JS → API Request → 
Backend Route → Database → Response → 
Frontend Render → User Sees Update
```

### Making Changes

1. **Change frontend**: Edit `public/*` files, refresh browser
2. **Change backend**: Edit `server/*` files, restart server
3. **Change database**: Edit `server/database.js`, restart server
4. **Change styles**: Edit `public/css/styles.css`, refresh browser

## 🎓 Advanced Topics

### Multiple Instances

Run multiple instances for redundancy:
```bash
PORT=3000 npm start &
PORT=3001 npm start &
PORT=3002 npm start &
```

Use nginx load balancer:
```nginx
upstream wordle_backend {
    server localhost:3000;
    server localhost:3001;
    server localhost:3002;
}
```

### Custom Authentication

Want multiple admin users? Edit `server/middleware/auth.js`:
```javascript
// Add user management
// Store users in database
// Implement registration/login
```

### Data Export

Export to JSON:
```bash
curl http://localhost:3000/api/stats/all-time > stats.json
```

Export to CSV (custom script):
```bash
sqlite3 data/wordle.db ".mode csv" ".output export.csv" \
        "SELECT * FROM results" ".quit"
```

### Webhooks

Want automatic imports from chat? Add webhook endpoint:
```javascript
// In server/routes/admin.js
router.post('/webhook/import', verifyWebhook, (req, res) => {
    const message = req.body.text;
    const result = db.addStreakData(message);
    res.json(result);
});
```

## 📊 Understanding Statistics

### Metrics Explained

- **Average Score**: Lower is better (1 = perfect, 7 = failed)
- **Participation Rate**: % of days played
- **Longest Streak**: Most consecutive days played
- **Consistency Score**: How regular is participation (0-1)
- **Score Variance**: How consistent are scores (lower = more consistent)

### Rankings

1. **Best Average** - Who gets the lowest average score
2. **Most Active** - Who plays most consistently
3. **Longest Streaks** - Who has best consecutive day streaks
4. **Most Consistent** - Who has least variance in scores

## 🔄 Updating the Application

```bash
# Pull latest changes (if using git)
git pull origin main

# Install any new dependencies
npm install

# Restart server
npm start  # or: sudo systemctl restart wordle
```

## 🎉 Success Checklist

After setup, verify everything works:

- [ ] Server starts without errors
- [ ] Can access http://localhost:3000
- [ ] Public page loads and shows interface
- [ ] Can access http://localhost:3000/admin
- [ ] Can login with admin password
- [ ] Can import data successfully
- [ ] Statistics display after import
- [ ] Charts render correctly
- [ ] Can view on mobile device
- [ ] Can generate video (may take 2-3 min)
- [ ] Can download database backup

## 🌟 Next Steps

Now that you're running:

1. **Import Your Data**
   - Gather Wordle messages from your group chat
   - Import them one by one via admin console
   - Watch your statistics grow!

2. **Share with Friends**
   - Share the public URL
   - Let them see their rankings
   - Healthy competition ensues!

3. **Generate Videos**
   - Create beautiful animated visualizations
   - Share on social media
   - Impress your group!

4. **Deploy to Production** (optional)
   - Follow DEPLOYMENT.md
   - Get a domain name
   - Set up SSL
   - Share with the world!

## 💻 For Developers

Want to customize or extend?

### Add New Statistic

1. **Backend**: Add calculation in `server/utils/stats.js`
2. **API**: Add endpoint in `server/routes/guest.js`
3. **Frontend**: Fetch and display in `public/js/guest.js`

### Add New Page

1. Create `public/new-page.html`
2. Add route in `server/index.js`:
   ```javascript
   app.get('/new-page', (req, res) => {
       res.sendFile(path.join(__dirname, '../public/new-page.html'));
   });
   ```
3. Add link in navigation

### Change Database Schema

1. Edit `server/database.js` → `initDatabase()`
2. Add migration logic for existing databases
3. Update related queries and API responses

## 🐛 Debug Mode

Enable detailed logging:

```bash
DEBUG=* npm start
```

Or add to `.env`:
```env
NODE_ENV=development
DEBUG=wordle:*
```

## 📱 Mobile Testing

Test on actual device:

1. Find your computer's IP: `ifconfig | grep "inet "`
2. Access from phone: `http://192.168.1.100:3000`
3. Test all features on mobile

Or use browser dev tools:
- Chrome/Edge: F12 → Toggle device toolbar
- Firefox: F12 → Responsive design mode
- Safari: Develop → Enter Responsive Design Mode

## 🎬 Video Generation Details

### How It Works

1. Queries database for all user scores over time
2. Generates PNG frames using Canvas
3. Uses ffmpeg to encode frames into MP4
4. Saves to `videos/` directory
5. Accessible via public page

### Performance

- 100 days of data = ~100 frames
- Each frame takes ~100ms to generate
- Total time: ~2-3 minutes
- Video file size: 5-20MB

### Troubleshooting Video Generation

**"Video generation started" but no video appears:**
- Check server console for errors
- Verify ffmpeg is installed: `ffmpeg -version`
- Check disk space: `df -h`
- Look in `videos/` directory

**Video is corrupted or won't play:**
- Try regenerating
- Check ffmpeg version is recent
- Verify Canvas installation

## 🔄 Workflow Examples

### Small Group (3-5 people)

- Import data daily
- Check rankings weekly
- Generate video monthly
- Casual competition

### Large Group (10+ people)

- Assign rotating admin duty
- Import data daily
- Generate video weekly
- Serious competition with prizes!

### Personal Tracking

- Import your own scores
- Track improvement over time
- Generate progress videos
- Share achievements

## 🎓 Best Practices

### Data Management

1. **Import regularly** - Don't let data pile up
2. **Backup before clearing** - Always download backup first
3. **Verify imports** - Check day details after import
4. **Monitor disk usage** - Videos can accumulate

### Admin Access

1. **Strong password** - 12+ characters
2. **Don't share password** - Admin access is powerful
3. **Logout when done** - Especially on shared computers
4. **Regular backups** - Download database weekly

### Performance

1. **Clean old videos** - Delete videos older than 30 days
2. **Monitor memory** - Restart if memory grows
3. **Database vacuum** - Run periodically for large databases
4. **Log rotation** - Don't let logs fill disk

## 📖 Additional Resources

- **README.md** - Complete technical documentation
- **DEPLOYMENT.md** - Production server deployment
- **CONTRIBUTING.md** - How to contribute
- **API Endpoints** - See README.md
- **GitHub Issues** - Report bugs or request features

## 🎉 You're Ready!

Congratulations! You now have:
- ✅ A running Wordle statistics web application
- ✅ Beautiful visualizations and charts
- ✅ Secure admin console
- ✅ Video generation capability
- ✅ Mobile-responsive design
- ✅ Production-ready codebase

**Start tracking your Wordle games and have fun!** 🎯

---

### Quick Commands Reference

```bash
# Start server
npm start

# Development mode
npm run dev

# Reset admin password
npm run setup

# View logs (systemd)
sudo journalctl -u wordle -f

# View logs (PM2)
pm2 logs wordle-web

# Backup database
cp data/wordle.db backups/backup_$(date +%Y%m%d).db

# Test API
curl http://localhost:3000/health
```

---

**Need help?** Check README.md or open an issue on GitHub!

**Happy Wordle tracking! 🎯📊🏆**


