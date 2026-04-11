const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { hashPassword } = require('./middleware/auth');
const crypto = require('crypto');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function setup() {
    console.log('🎯 Wordle Stats Web Application - Setup\n');
    console.log('This wizard will help you configure your application.\n');

    // Check if .env already exists
    const envPath = path.join(__dirname, '../.env');
    if (fs.existsSync(envPath)) {
        const overwrite = await question('.env file already exists. Overwrite? (yes/no): ');
        if (overwrite.toLowerCase() !== 'yes') {
            console.log('Setup cancelled.');
            rl.close();
            return;
        }
    }

    // Get admin password
    console.log('\n📝 Admin Password Setup');
    console.log('Choose a strong password for the admin console.\n');
    
    const password = await question('Enter admin password: ');
    if (!password || password.length < 6) {
        console.log('❌ Password must be at least 6 characters long.');
        rl.close();
        return;
    }

    const confirmPassword = await question('Confirm admin password: ');
    if (password !== confirmPassword) {
        console.log('❌ Passwords do not match.');
        rl.close();
        return;
    }

    console.log('\n⏳ Hashing password...');
    const passwordHash = await hashPassword(password);

    // Generate JWT secret
    const jwtSecret = crypto.randomBytes(32).toString('hex');

    // Get port
    const defaultPort = '3000';
    const port = await question(`\nServer port (default ${defaultPort}): `) || defaultPort;

    // Create .env file
    const envContent = `# Wordle Stats Web Application Configuration
# Generated on ${new Date().toISOString()}

NODE_ENV=production
PORT=${port}
DATABASE_PATH=./data/wordle.db
VIDEO_PATH=./videos
ADMIN_PASSWORD_HASH=${passwordHash}
JWT_SECRET=${jwtSecret}
`;

    fs.writeFileSync(envPath, envContent);

    // Create necessary directories
    const dataDir = path.join(__dirname, '../data');
    const videosDir = path.join(__dirname, '../videos');
    const backupsDir = path.join(__dirname, '../backups');

    [dataDir, videosDir, backupsDir].forEach(dir => {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
            console.log(`✅ Created directory: ${path.basename(dir)}/`);
        }
    });

    // Test database initialization
    console.log('\n⏳ Testing database connection...');
    try {
        const WordleDatabase = require('./database');
        const db = new WordleDatabase();
        const overview = db.getBriefOverview();
        console.log('✅ Database initialized successfully');
        console.log(`   • ${overview.total_streaks} days`);
        console.log(`   • ${overview.total_users} users`);
        console.log(`   • ${overview.total_entries} entries`);
        db.close();
    } catch (error) {
        console.log('⚠️  Warning: Could not initialize database');
        console.log(`   ${error.message}`);
    }

    console.log('\n🎉 Setup complete!\n');
    console.log('Configuration saved to .env');
    console.log('\n📝 Next steps:');
    console.log('   1. Install dependencies: npm install');
    console.log('   2. Start the server: npm start');
    console.log('   3. Access public view: http://localhost:' + port);
    console.log('   4. Access admin console: http://localhost:' + port + '/admin');
    console.log('\n⚠️  Keep your admin password secure!');
    console.log('   Password: ' + '*'.repeat(password.length) + ' (not displayed)\n');

    rl.close();
}

setup().catch(error => {
    console.error('❌ Setup failed:', error.message);
    rl.close();
    process.exit(1);
});


