#!/usr/bin/env node

/**
 * Password Reset Utility
 * Run this script to reset your admin password
 * Usage: node reset-password.js
 */

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcrypt');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function question(query) {
    return new Promise(resolve => rl.question(query, resolve));
}

async function resetPassword() {
    console.log('\n🔐 Wordle Stats - Password Reset Utility\n');

    const envPath = path.join(__dirname, '.env');

    if (!fs.existsSync(envPath)) {
        console.error('❌ Error: .env file not found!');
        console.log('Please run: npm run setup');
        rl.close();
        process.exit(1);
    }

    // Read current .env file
    let envContent = fs.readFileSync(envPath, 'utf8');

    console.log('This will update your admin password.\n');

    const password = await question('Enter new admin password: ');

    if (!password || password.length < 6) {
        console.log('❌ Password must be at least 6 characters long.');
        rl.close();
        return;
    }

    const confirmPassword = await question('Confirm new password: ');

    if (password !== confirmPassword) {
        console.log('❌ Passwords do not match.');
        rl.close();
        return;
    }

    console.log('\n⏳ Hashing password...');
    const passwordHash = await bcrypt.hash(password, 10);

    // Update or add ADMIN_PASSWORD_HASH in .env file
    const hashRegex = /^ADMIN_PASSWORD_HASH=.*$/m;

    if (hashRegex.test(envContent)) {
        // Replace existing hash
        envContent = envContent.replace(hashRegex, `ADMIN_PASSWORD_HASH=${passwordHash}`);
    } else {
        // Add new hash
        envContent += `\nADMIN_PASSWORD_HASH=${passwordHash}\n`;
    }

    // Write updated .env file
    fs.writeFileSync(envPath, envContent);

    console.log('\n✅ Password updated successfully!');
    console.log('\n📝 Next steps:');
    console.log('   1. Restart the server for changes to take effect');
    console.log('   2. Login with your new password at /admin\n');

    rl.close();
}

resetPassword().catch(error => {
    console.error('❌ Error:', error.message);
    rl.close();
    process.exit(1);
});
