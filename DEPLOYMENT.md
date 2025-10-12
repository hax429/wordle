# Deployment Guide - Oracle Linux

Complete guide for deploying Wordle Stats Web Application on Oracle Linux with nginx reverse proxy.

## Prerequisites

- Oracle Linux 8 or 9
- Root or sudo access
- Domain name pointed to your server (optional but recommended)

## Step 1: System Preparation

### Update System

```bash
sudo dnf update -y
```

### Install Node.js

```bash
# Install Node.js 18.x (LTS)
curl -fsSL https://rpm.nodesource.com/setup_18.x | sudo bash -
sudo dnf install -y nodejs

# Verify installation
node --version
npm --version
```

### Install nginx

```bash
sudo dnf install -y nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### Install SQLite (usually pre-installed)

```bash
sudo dnf install -y sqlite
```

### Install Python (for video generation)

```bash
sudo dnf install -y python3 python3-pip
pip3 install matplotlib numpy scipy
```

## Step 2: Create User and Directory

```bash
# Create wordle user
sudo useradd -r -s /bin/bash -d /opt/wordle wordle

# Create application directory
sudo mkdir -p /opt/wordle
sudo chown wordle:wordle /opt/wordle
```

## Step 3: Deploy Application

### Upload Files

```bash
# From your local machine
scp -r wordle-web/* user@your-server:/tmp/wordle-web/

# On server, move to application directory
sudo mv /tmp/wordle-web/* /opt/wordle/
sudo chown -R wordle:wordle /opt/wordle
```

### Install Dependencies

```bash
cd /opt/wordle
sudo -u wordle npm install --production
```

### Run Setup

```bash
cd /opt/wordle
sudo -u wordle npm run setup
```

Follow the prompts to:
- Set admin password
- Configure port (default 3000)
- Generate security keys

## Step 4: Configure systemd Service

### Create Service File

```bash
sudo nano /etc/systemd/system/wordle.service
```

Paste the following (update paths if needed):

```ini
[Unit]
Description=Wordle Stats Web Application
After=network.target

[Service]
Type=simple
User=wordle
Group=wordle
WorkingDirectory=/opt/wordle
ExecStart=/usr/bin/node server/index.js
Restart=on-failure
RestartSec=10

Environment=NODE_ENV=production
EnvironmentFile=/opt/wordle/.env

StandardOutput=journal
StandardError=journal
SyslogIdentifier=wordle-web

NoNewPrivileges=true
PrivateTmp=true

LimitNOFILE=65536
MemoryLimit=1G

[Install]
WantedBy=multi-user.target
```

### Enable and Start Service

```bash
sudo systemctl daemon-reload
sudo systemctl enable wordle
sudo systemctl start wordle

# Check status
sudo systemctl status wordle

# View logs
sudo journalctl -u wordle -f
```

## Step 5: Configure nginx

### Create nginx Configuration

```bash
sudo nano /etc/nginx/conf.d/wordle.conf
```

Paste the following (update your-domain.com):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    location /videos/ {
        alias /opt/wordle/videos/;
        expires 1d;
        add_header Cache-Control "public, immutable";
    }

    location ~ /\.env {
        deny all;
        return 404;
    }

    gzip on;
    gzip_vary on;
    gzip_types text/plain text/css text/javascript application/javascript application/json;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    access_log /var/log/nginx/wordle-access.log;
    error_log /var/log/nginx/wordle-error.log;
}
```

### Test and Reload nginx

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## Step 6: Configure Firewall

```bash
# Open HTTP and HTTPS ports
sudo firewall-cmd --permanent --add-service=http
sudo firewall-cmd --permanent --add-service=https
sudo firewall-cmd --reload

# Verify
sudo firewall-cmd --list-all
```

## Step 7: SSL/HTTPS Setup (Recommended)

### Install Certbot

```bash
sudo dnf install -y epel-release
sudo dnf install -y certbot python3-certbot-nginx
```

### Obtain Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will:
- Obtain certificate
- Update nginx configuration
- Set up auto-renewal

### Verify Auto-Renewal

```bash
sudo certbot renew --dry-run
```

## Step 8: Migrate Existing Data (Optional)

If migrating from Python version:

```bash
# Copy existing database
scp /path/to/old/wordle_database.db user@server:/tmp/
sudo mv /tmp/wordle_database.db /opt/wordle/data/wordle.db
sudo chown wordle:wordle /opt/wordle/data/wordle.db

# Restart service
sudo systemctl restart wordle
```

## Step 9: Set Up Backups

### Create Backup Script

```bash
sudo nano /opt/wordle/backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/opt/wordle/backups"
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/wordle_backup_$DATE.db"

mkdir -p $BACKUP_DIR
cp /opt/wordle/data/wordle.db $BACKUP_FILE

# Keep only last 30 backups
ls -t $BACKUP_DIR/wordle_backup_*.db | tail -n +31 | xargs -r rm

echo "Backup created: $BACKUP_FILE"
```

```bash
sudo chmod +x /opt/wordle/backup.sh
sudo chown wordle:wordle /opt/wordle/backup.sh
```

### Set Up Cron Job

```bash
sudo -u wordle crontab -e
```

Add:
```
0 2 * * * /opt/wordle/backup.sh
```

## Step 10: Monitoring

### Check Application Status

```bash
# Service status
sudo systemctl status wordle

# View logs
sudo journalctl -u wordle -n 50

# Follow logs in real-time
sudo journalctl -u wordle -f

# nginx logs
sudo tail -f /var/log/nginx/wordle-access.log
sudo tail -f /var/log/nginx/wordle-error.log
```

### Health Check

```bash
curl http://localhost:3000/health
curl https://your-domain.com/health
```

## Common Post-Deployment Tasks

### Update Application

```bash
# Stop service
sudo systemctl stop wordle

# Update files
cd /opt/wordle
sudo -u wordle git pull  # if using git
# or upload new files

# Install any new dependencies
sudo -u wordle npm install --production

# Start service
sudo systemctl start wordle

# Check status
sudo systemctl status wordle
```

### Change Admin Password

```bash
cd /opt/wordle
sudo -u wordle npm run setup
# Choose to overwrite existing .env
```

### View Database

```bash
cd /opt/wordle
sudo -u wordle sqlite3 data/wordle.db
sqlite> .tables
sqlite> SELECT COUNT(*) FROM streaks;
sqlite> .quit
```

## Performance Tuning

### Node.js Process

Edit `/etc/systemd/system/wordle.service`:

```ini
# Increase memory limit if needed
MemoryLimit=2G

# Set CPU affinity
CPUAffinity=0-3
```

### nginx

Edit `/etc/nginx/nginx.conf`:

```nginx
worker_processes auto;
worker_connections 2048;

# Enable connection pooling
upstream wordle_backend {
    server localhost:3000;
    keepalive 32;
}
```

## Security Hardening

### SELinux Context (if enabled)

```bash
sudo semanage port -a -t http_port_t -p tcp 3000
sudo setsebool -P httpd_can_network_connect 1
```

### Rate Limiting

Already configured in the application, but can add nginx-level:

```nginx
limit_req_zone $binary_remote_addr zone=general:10m rate=10r/s;
limit_req zone=general burst=20 nodelay;
```

### Fail2ban

```bash
sudo dnf install -y fail2ban

sudo nano /etc/fail2ban/jail.local
```

```ini
[nginx-limit-req]
enabled = true
filter = nginx-limit-req
logpath = /var/log/nginx/wordle-error.log
maxretry = 5
findtime = 600
bantime = 3600
```

## Troubleshooting

### Application Won't Start

```bash
# Check logs
sudo journalctl -u wordle -n 100

# Check if port is in use
sudo lsof -i :3000

# Check file permissions
ls -la /opt/wordle

# Test manually
cd /opt/wordle
sudo -u wordle node server/index.js
```

### nginx Errors

```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/error.log

# Verify proxy pass
curl -I http://localhost:3000
```

### Database Issues

```bash
# Check database file
ls -lh /opt/wordle/data/wordle.db

# Verify integrity
sqlite3 /opt/wordle/data/wordle.db "PRAGMA integrity_check;"

# Check permissions
sudo -u wordle sqlite3 /opt/wordle/data/wordle.db "SELECT 1;"
```

## Maintenance

### Regular Tasks

- Daily: Monitor logs for errors
- Weekly: Check disk space usage
- Monthly: Review and rotate logs
- Quarterly: Update system packages and Node.js

### Log Rotation

nginx logs rotate automatically. For application logs:

```bash
sudo nano /etc/logrotate.d/wordle
```

```
/var/log/nginx/wordle-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    sharedscripts
    postrotate
        /usr/bin/systemctl reload nginx > /dev/null 2>&1
    endscript
}
```

## Success Checklist

- [ ] Application starts without errors
- [ ] Can access http://your-domain.com
- [ ] Can access admin console
- [ ] HTTPS works (if configured)
- [ ] Can import data successfully
- [ ] Statistics display correctly
- [ ] Charts render properly on mobile
- [ ] Backups are working
- [ ] Logs are accessible
- [ ] Service starts on boot

## Support

If you encounter issues:
1. Check application logs: `sudo journalctl -u wordle -f`
2. Check nginx logs: `sudo tail -f /var/log/nginx/wordle-error.log`
3. Verify service status: `sudo systemctl status wordle`
4. Test health endpoint: `curl http://localhost:3000/health`

---

**Deployment complete! 🎉**

Access your application at: https://your-domain.com

