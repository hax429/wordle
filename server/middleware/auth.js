/**
 * Admin Authentication Middleware
 *
 * Provides JWT-based authentication for the /admin panel.
 *
 * Setup (one-time):
 *   1. Run `node server/setup.js` to generate a bcrypt hash of your admin password.
 *   2. Set ADMIN_PASSWORD_HASH=<generated_hash> in your .env file.
 *   3. Set JWT_SECRET=<random_string> in your .env file (use a long random value).
 *
 * ⚠️  SECURITY: Never leave JWT_SECRET unset in production — the fallback value
 * is publicly known and provides no security.
 */

import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

// IMPORTANT: JWT_SECRET must be set in .env for production.
// The fallback is only for local dev convenience and is NOT secure.
if (!process.env.JWT_SECRET) {
    console.warn('[Auth] WARNING: JWT_SECRET is not set in .env — using insecure fallback. Set a strong secret before deploying!');
}
const JWT_SECRET = process.env.JWT_SECRET || 'discordwordle_secret';

// IMPORTANT: ADMIN_PASSWORD_HASH must be set in .env.
// Generate it by running: node server/setup.js
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware to verify JWT token
export function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// Function to verify password and generate token
export async function login(password) {
    if (!ADMIN_PASSWORD_HASH) {
        throw new Error('Admin password not configured');
    }

    const isValid = await bcrypt.compare(password, ADMIN_PASSWORD_HASH);

    if (!isValid) {
        throw new Error('Invalid password');
    }

    // Generate JWT token (expires in 24 hours)
    const token = jwt.sign(
        { role: 'admin', timestamp: Date.now() },
        JWT_SECRET,
        { expiresIn: '24h' }
    );

    return token;
}

// Function to hash password (for setup)
export async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}


