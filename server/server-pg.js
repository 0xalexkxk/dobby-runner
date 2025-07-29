const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
let server;

// PostgreSQL connection pool with IPv4 Supabase pooler
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://postgres.rcyxbenthvrgzhyltuwh:DobbyRunner123@aws-0-eu-central-1.pooler.supabase.com:6543/postgres',
    ssl: {
        rejectUnauthorized: false
    },
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 15000,
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('Database connection error:', err);
    } else {
        console.log('Database connected at:', res.rows[0].now);
    }
});

// Trust proxy only for ngrok (localhost)
app.set('trust proxy', '127.0.0.1');

// Security middleware
app.use(helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "blob:"],
            connectSrc: ["'self'", "http://localhost:3000", "https://*.ngrok.io", "https://*.ngrok-free.app"]
        }
    }
}));

// Allow all origins for testing (change this in production!)
app.use(cors({
    origin: true, // Allow all origins for public testing
    credentials: true
}));
app.use(express.json({ limit: '100kb' })); // Increased limit for game events

// Initialize database tables
async function initDB() {
    try {
        // Create table if not exists
        await pool.query(`
            CREATE TABLE IF NOT EXISTS scores (
                id SERIAL PRIMARY KEY,
                nickname TEXT NOT NULL,
                score INTEGER NOT NULL,
                xp INTEGER NOT NULL,
                level INTEGER NOT NULL,
                game_time INTEGER NOT NULL,
                ip_address TEXT,
                user_agent TEXT,
                timestamp BIGINT NOT NULL,
                is_valid BOOLEAN DEFAULT true,
                validation_hash TEXT
            )
        `);
        
        // Create indexes for better performance
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_score ON scores(score DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_valid_scores ON scores(is_valid, score DESC)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_nickname ON scores(nickname)`);
        await pool.query(`CREATE INDEX IF NOT EXISTS idx_timestamp ON scores(timestamp)`);
        
        console.log('Database tables initialized successfully!');
    } catch (err) {
        console.error('Error initializing database:', err);
    }
}

// Initialize DB on startup
initDB();

// Simple in-memory cache for leaderboard
let leaderboardCache = {
    data: null,
    timestamp: 0,
    TTL: 30 * 1000 // 30 seconds cache
};

function getCachedLeaderboard() {
    const now = Date.now();
    if (leaderboardCache.data && (now - leaderboardCache.timestamp) < leaderboardCache.TTL) {
        return leaderboardCache.data;
    }
    return null;
}

function setCachedLeaderboard(data) {
    leaderboardCache.data = data;
    leaderboardCache.timestamp = Date.now();
}

// Performance monitoring
let requestStats = {
    submitCount: 0,
    leaderboardCount: 0,
    errorCount: 0,
    lastReset: Date.now()
};

function logPerformance() {
    const now = Date.now();
    const timeSinceReset = now - requestStats.lastReset;
    const minutes = timeSinceReset / (1000 * 60);
    
    if (minutes > 0) {
        console.log(`📊 Performance Stats (last ${minutes.toFixed(1)} min):`);
        console.log(`   Submit requests: ${requestStats.submitCount} (${(requestStats.submitCount/minutes).toFixed(1)}/min)`);
        console.log(`   Leaderboard requests: ${requestStats.leaderboardCount} (${(requestStats.leaderboardCount/minutes).toFixed(1)}/min)`);
        console.log(`   Errors: ${requestStats.errorCount}`);
    }
    
    // Reset stats every hour
    if (timeSinceReset > 60 * 60 * 1000) {
        requestStats = {
            submitCount: 0,
            leaderboardCount: 0,
            errorCount: 0,
            lastReset: now
        };
    }
}

// Log performance every 5 minutes
setInterval(logPerformance, 5 * 60 * 1000);

// Anti-cheat validation
class AntiCheat {
    static validateGameData(data) {
        const { score, xp, level, gameTime, events } = data;
        
        // Basic sanity checks
        if (score < 0 || xp < 0 || level < 1 || level > 5) {
            return { valid: false, reason: 'Invalid game values' };
        }
        
        // Check score vs level consistency (matching client logic)
        if (level === 1 && score >= 100) return { valid: false, reason: 'Level mismatch' };
        if (level === 2 && (score < 100 || score >= 200)) return { valid: false, reason: 'Level mismatch' };
        if (level === 3 && (score < 200 || score >= 300)) return { valid: false, reason: 'Level mismatch' };
        if (level === 4 && score < 300) return { valid: false, reason: 'Level mismatch' }; // Level 4 has no upper limit
        if (level === 5 && score < 400) return { valid: false, reason: 'Level mismatch' };
        
        // Check game time vs score ratio (approximate)
        const minTimePerScore = 0.1; // seconds per point (more realistic for teacup hits)
        const gameTimeSeconds = gameTime / 60; // assuming 60 FPS
        if (score > gameTimeSeconds / minTimePerScore) {
            return { valid: false, reason: 'Score too high for game duration' };
        }
        
        // Validate events
        if (!Array.isArray(events)) {
            return { valid: false, reason: 'Invalid events data' };
        }
        
        // Check event sequence and timing
        let lastEventTime = 0;
        let teacupHits = 0;
        let xpCollected = 0;
        
        for (const event of events) {
            if (event.time < lastEventTime) {
                return { valid: false, reason: 'Invalid event sequence' };
            }
            lastEventTime = event.time;
            
            if (event.type === 'hit_teacup') teacupHits++;
            if (event.type === 'collect_xp') xpCollected++;
        }
        
        // Validate score calculation
        const expectedMinScore = teacupHits * 5;
        if (score < expectedMinScore) {
            return { valid: false, reason: 'Score calculation mismatch' };
        }
        
        // Basic XP validation (allow some flexibility for bonus XP)
        if (xp < 0 || xp > (gameTimeSeconds * 10)) { // Max ~10 XP per second
            return { valid: false, reason: 'XP out of reasonable range' };
        }
        
        // Check for superhuman play patterns
        const jumpsPerMinute = events.filter(e => e.type === 'jump').length / (gameTimeSeconds / 60);
        if (jumpsPerMinute > 120) { // More than 2 jumps per second sustained
            return { valid: false, reason: 'Superhuman play detected' };
        }
        
        const shotsPerMinute = events.filter(e => e.type === 'shoot').length / (gameTimeSeconds / 60);
        if (shotsPerMinute > 180) { // More than 3 shots per second sustained
            return { valid: false, reason: 'Superhuman play detected' };
        }
        
        return { valid: true };
    }
    
    static generateValidationHash(data) {
        const secret = process.env.SECRET_KEY || 'donut-runner-secret-2024';
        const dataString = `${data.nickname}-${data.score}-${data.xp}-${data.level}-${data.timestamp}`;
        return crypto.createHmac('sha256', secret).update(dataString).digest('hex');
    }
}

// API Routes
app.post('/api/submit-score', async (req, res) => {
    try {
        requestStats.submitCount++;
        const gameData = req.body;
        const validation = AntiCheat.validateGameData(gameData);
        
        if (!validation.valid) {
            console.log(`Cheat detected: ${validation.reason} from IP ${req.ip}`);
            console.log('Game data:', JSON.stringify(gameData, null, 2));
            return res.status(400).json({ error: 'Invalid game data', reason: validation.reason });
        }
        
        // Additional checks
        if (!gameData.nickname || gameData.nickname.length > 20) {
            return res.status(400).json({ error: 'Invalid nickname' });
        }
        
        // Sanitize nickname
        const nickname = gameData.nickname.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
        if (!nickname) {
            return res.status(400).json({ error: 'Invalid nickname' });
        }
        
        // Generate validation hash
        const validationHash = AntiCheat.generateValidationHash(gameData);
        
        // Check if player already has a score
        const existingScore = await pool.query(
            'SELECT score FROM scores WHERE nickname = $1 LIMIT 1',
            [nickname]
        );
        
        if (existingScore.rows.length > 0) {
            // Player exists - only update if new score is higher
            if (gameData.score <= existingScore.rows[0].score) {
                return res.json({ 
                    success: true, 
                    message: 'Score not updated - previous best is higher',
                    previousBest: existingScore.rows[0].score,
                    currentScore: gameData.score
                });
            }
            
            // Update existing record with higher score
            await pool.query(`
                UPDATE scores 
                SET score = $1, xp = $2, level = $3, game_time = $4, 
                    ip_address = $5, user_agent = $6, timestamp = $7, validation_hash = $8
                WHERE nickname = $9
            `, [
                gameData.score,
                gameData.xp,
                gameData.level,
                gameData.gameTime,
                req.ip,
                req.get('user-agent'),
                gameData.timestamp,
                validationHash,
                nickname
            ]);
            
            // Invalidate leaderboard cache
            leaderboardCache.data = null;
            
            res.json({ 
                success: true, 
                message: 'New high score updated!',
                previousBest: existingScore.rows[0].score,
                newBest: gameData.score
            });
        } else {
            // New player - insert score
            await pool.query(`
                INSERT INTO scores (nickname, score, xp, level, game_time, ip_address, user_agent, timestamp, validation_hash)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            `, [
                nickname,
                gameData.score,
                gameData.xp,
                gameData.level,
                gameData.gameTime,
                req.ip,
                req.get('user-agent'),
                gameData.timestamp,
                validationHash
            ]);
            
            // Invalidate leaderboard cache
            leaderboardCache.data = null;
            
            res.json({ success: true, message: 'Score submitted successfully' });
        }
        
    } catch (error) {
        requestStats.errorCount++;
        console.error('Error submitting score:', error);
        res.status(500).json({ error: 'Server error', details: error.message });
    }
});

// Update nickname
app.post('/api/update-nickname', async (req, res) => {
    try {
        const { oldNickname, newNickname } = req.body;
        
        if (!oldNickname || !newNickname) {
            return res.status(400).json({ error: 'Both old and new nicknames are required' });
        }
        
        // Sanitize nicknames
        const cleanOldNickname = oldNickname.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
        const cleanNewNickname = newNickname.replace(/[^a-zA-Z0-9\s_-]/g, '').trim();
        
        if (!cleanOldNickname || !cleanNewNickname || cleanNewNickname.length < 2) {
            return res.status(400).json({ error: 'Invalid nickname format' });
        }
        
        // Check if new nickname already exists
        const existing = await pool.query(
            'SELECT nickname FROM scores WHERE nickname = $1 LIMIT 1',
            [cleanNewNickname]
        );
        
        if (existing.rows.length > 0 && cleanOldNickname !== cleanNewNickname) {
            return res.status(400).json({ error: 'Nickname already taken' });
        }
        
        // Update the nickname
        await pool.query(
            'UPDATE scores SET nickname = $1 WHERE nickname = $2',
            [cleanNewNickname, cleanOldNickname]
        );
        
        res.json({ success: true, message: 'Nickname updated successfully' });
        
    } catch (error) {
        console.error('Error updating nickname:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/leaderboard', async (req, res) => {
    try {
        requestStats.leaderboardCount++;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        // Try to get from cache first
        const cached = getCachedLeaderboard();
        if (cached && cached.length >= limit) {
            return res.json(cached.slice(0, limit));
        }
        
        // Get fresh data from database
        const result = await pool.query(`
            SELECT nickname, MAX(score) as score, 
                   MAX(level) as level, MAX(timestamp) as timestamp
            FROM scores
            WHERE is_valid = true
            GROUP BY nickname
            ORDER BY score DESC
            LIMIT $1
        `, [100]); // Always fetch top 100 for cache
        
        // Cache the results
        setCachedLeaderboard(result.rows);
        
        // Return requested limit
        res.json(result.rows.slice(0, limit));
    } catch (error) {
        requestStats.errorCount++;
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin route to clear leaderboard (GET version for easy browser access)
app.get('/api/admin/clear-leaderboard', async (req, res) => {
    // TEMPORARILY DISABLED - Remove this block when ready to enable
    return res.status(403).json({ 
        error: 'Clear leaderboard is temporarily disabled',
        message: 'This endpoint has been temporarily disabled for maintenance'
    });
    
    try {
        const result = await pool.query('DELETE FROM scores');
        
        console.log(`Cleared ${result.rowCount} scores from leaderboard`);
        
        // Clear leaderboard cache
        leaderboardCache.data = null;
        
        // Check how many records remain
        const countResult = await pool.query('SELECT COUNT(*) as count FROM scores');
        const remaining = countResult.rows[0].count;
        
        res.json({ 
            success: true, 
            message: `Cleared ${result.rowCount} scores from leaderboard`,
            remaining_records: remaining
        });
    } catch (error) {
        console.error('Error clearing leaderboard:', error);
        res.status(500).json({ error: 'Failed to clear leaderboard' });
    }
});

// Admin route to check suspicious scores (protected in production)
app.get('/api/admin/suspicious', async (req, res) => {
    // In production, add authentication here
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    try {
        const result = await pool.query(`
            SELECT *
            FROM scores
            WHERE is_valid = false
            OR score > 1000
            OR game_time < score * 10
            ORDER BY timestamp DESC
            LIMIT 50
        `);
        
        res.json(result.rows);
    } catch (error) {
        console.error('Error fetching suspicious scores:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin route to backup all scores
app.get('/api/admin/backup-scores', async (req, res) => {
    // In production, add authentication here
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    try {
        const result = await pool.query(`
            SELECT *
            FROM scores
            ORDER BY timestamp DESC
        `);
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="donut-runner-scores-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
            exportDate: new Date().toISOString(),
            totalScores: result.rows.length,
            scores: result.rows
        });
    } catch (error) {
        console.error('Error backing up scores:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Health check endpoint
app.get('/api/health', async (req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    // Check database connection
    let dbStatus = 'healthy';
    try {
        await pool.query('SELECT 1');
    } catch (err) {
        dbStatus = 'unhealthy';
    }
    
    res.json({
        status: dbStatus === 'healthy' ? 'healthy' : 'degraded',
        database: dbStatus,
        uptime: `${Math.floor(uptime / 60)} minutes`,
        memory: {
            rss: `${Math.round(memUsage.rss / 1024 / 1024)} MB`,
            heapUsed: `${Math.round(memUsage.heapUsed / 1024 / 1024)} MB`,
            heapTotal: `${Math.round(memUsage.heapTotal / 1024 / 1024)} MB`
        },
        stats: {
            submitRequests: requestStats.submitCount,
            leaderboardRequests: requestStats.leaderboardCount,
            errors: requestStats.errorCount,
            cacheHit: leaderboardCache.data ? 'yes' : 'no'
        },
        timestamp: new Date().toISOString()
    });
});

// Serve static files
app.use(express.static(path.join(__dirname, '../client')));
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server on all interfaces for public access
server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Donut Runner server running on port ${PORT}`);
    console.log(`🌐 ngrok Public access: https://4f29-2a03-f680-fe04-49c4-6cc3-703c-5cd-ae7d.ngrok-free.app`);
    console.log(`🏠 Local access: http://localhost:${PORT}`);
    console.log(`📍 Local network: http://192.168.100.177:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`Database: ${process.env.DATABASE_URL ? 'PostgreSQL (Supabase)' : 'Not configured!'}`);
    console.log('🎮 Share this URL with friends: https://4f29-2a03-f680-fe04-49c4-6cc3-703c-5cd-ae7d.ngrok-free.app');
    console.log('💪 Server optimized for 100+ concurrent users');
});

// Graceful shutdown
function gracefulShutdown(signal) {
    console.log(`\n${signal} signal received: starting graceful shutdown`);
    
    if (server) {
        server.close((err) => {
            if (err) {
                console.error('Error during server shutdown:', err);
                process.exit(1);
            }
            
            console.log('HTTP server closed');
            
            // Close database connection pool
            pool.end((err) => {
                if (err) {
                    console.error('Error closing database pool:', err);
                    process.exit(1);
                }
                console.log('Database connection pool closed');
                console.log('Graceful shutdown complete');
                process.exit(0);
            });
        });
        
        // Force exit after timeout
        setTimeout(() => {
            console.error('Forced shutdown after timeout');
            process.exit(1);
        }, 30000); // 30 seconds timeout
    } else {
        process.exit(0);
    }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
    gracefulShutdown('UNCAUGHT_EXCEPTION');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown('UNHANDLED_REJECTION');
});