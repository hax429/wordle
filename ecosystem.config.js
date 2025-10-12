// PM2 Ecosystem Configuration
// Use this for process management with PM2

module.exports = {
  apps: [{
    name: 'wordle-web',
    script: './server/index.js',
    
    // Instances
    instances: 1,
    exec_mode: 'fork',
    
    // Restart behavior
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    
    // Environment variables
    env: {
      NODE_ENV: 'development',
      PORT: 3000
    },
    env_production: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    
    // Logging
    error_file: './logs/error.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    
    // Advanced features
    min_uptime: '10s',
    max_restarts: 10,
    
    // Monitoring
    listen_timeout: 3000,
    kill_timeout: 5000
  }]
};


