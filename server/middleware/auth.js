const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'change-this-secret-in-production';
const ADMIN_PASSWORD_HASH = process.env.ADMIN_PASSWORD_HASH;

// Middleware to verify JWT token
function verifyToken(req, res, next) {
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
async function login(password) {
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
async function hashPassword(password) {
    const saltRounds = 10;
    return await bcrypt.hash(password, saltRounds);
}

module.exports = {
    verifyToken,
    login,
    hashPassword
};


