const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const path = require('path');
const cluster = require('cluster');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
let server;

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

// Rate limiting optimized for 100 concurrent users
const submitLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Higher for load testing
    message: 'Too many score submissions, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    validate: false
});

const leaderboardLimiter = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 1000, // Much higher for leaderboard requests during testing
    standardHeaders: true,
    legacyHeaders: false,
    validate: false
});

// Database setup with performance optimizations
const db = new sqlite3.Database('./leaderboard.db');

// Enable WAL mode for better concurrent performance
db.run("PRAGMA journal_mode = WAL");
db.run("PRAGMA synchronous = NORMAL");
db.run("PRAGMA cache_size = 10000");
db.run("PRAGMA temp_store = MEMORY");
db.run("PRAGMA mmap_size = 268435456"); // 256MB

db.serialize(() => {
    // Create table only if it doesn't exist
    db.run(`CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        nickname TEXT NOT NULL,
        score INTEGER NOT NULL,
        xp INTEGER NOT NULL,
        level INTEGER NOT NULL,
        game_time INTEGER NOT NULL,
        ip_address TEXT,
        user_agent TEXT,
        timestamp INTEGER NOT NULL,
        is_valid BOOLEAN DEFAULT 1,
        validation_hash TEXT
    )`, (err) => {
        if (err) {
            console.error('Error creating scores table:', err);
        } else {
            console.log('Leaderboard table ready!');
        }
    });
    
    // Create indexes for faster queries
    db.run(`CREATE INDEX IF NOT EXISTS idx_score ON scores(score DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_valid_scores ON scores(is_valid, score DESC)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_nickname ON scores(nickname)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_timestamp ON scores(timestamp)`);
});

// Database utilities for better performance
const dbUtils = {
    get: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.get(sql, params, (err, row) => {
                if (err) reject(err);
                else resolve(row);
            });
        });
    },
    
    all: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.all(sql, params, (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
    },
    
    run: (sql, params = []) => {
        return new Promise((resolve, reject) => {
            db.run(sql, params, function(err) {
                if (err) reject(err);
                else resolve({ lastID: this.lastID, changes: this.changes });
            });
        });
    }
};

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
app.post('/api/submit-score', /* submitLimiter, */ async (req, res) => {
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
        const existingScore = await dbUtils.get('SELECT score FROM scores WHERE nickname = ?', [nickname]);
        
        if (existingScore) {
            // Player exists - only update if new score is higher
            if (gameData.score <= existingScore.score) {
                return res.json({ 
                    success: true, 
                    message: 'Score not updated - previous best is higher',
                    previousBest: existingScore.score,
                    currentScore: gameData.score
                });
            }
            
            // Update existing record with higher score
            await dbUtils.run(`
                UPDATE scores 
                SET score = ?, xp = ?, level = ?, game_time = ?, 
                    ip_address = ?, user_agent = ?, timestamp = ?, validation_hash = ?
                WHERE nickname = ?
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
                previousBest: existingScore.score,
                newBest: gameData.score
            });
        } else {
            // New player - insert score
            await dbUtils.run(`
                INSERT INTO scores (nickname, score, xp, level, game_time, ip_address, user_agent, timestamp, validation_hash)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
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
app.post('/api/update-nickname', /* submitLimiter, */ (req, res) => {
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
        db.get('SELECT nickname FROM scores WHERE nickname = ?', [cleanNewNickname], (err, row) => {
            if (err) {
                console.error('Database error:', err);
                return res.status(500).json({ error: 'Database error' });
            }
            
            if (row && cleanOldNickname !== cleanNewNickname) {
                return res.status(400).json({ error: 'Nickname already taken' });
            }
            
            // Update the nickname
            const updateStmt = db.prepare('UPDATE scores SET nickname = ? WHERE nickname = ?');
            updateStmt.run(cleanNewNickname, cleanOldNickname, function(err) {
                if (err) {
                    console.error('Database error:', err);
                    updateStmt.finalize();
                    return res.status(500).json({ error: 'Failed to update nickname' });
                }
                
                updateStmt.finalize();
                res.json({ success: true, message: 'Nickname updated successfully' });
            });
        });
    } catch (error) {
        console.error('Error updating nickname:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/api/leaderboard', /* leaderboardLimiter, */ async (req, res) => {
    try {
        requestStats.leaderboardCount++;
        const limit = Math.min(parseInt(req.query.limit) || 50, 100);
        
        // Try to get from cache first
        const cached = getCachedLeaderboard();
        if (cached && cached.length >= limit) {
            return res.json(cached.slice(0, limit));
        }
        
        // Get fresh data from database
        const rows = await dbUtils.all(`
            SELECT nickname, MAX(score) as score, level, timestamp
            FROM scores
            WHERE is_valid = 1
            GROUP BY nickname
            ORDER BY score DESC
            LIMIT ?
        `, [100]); // Always fetch top 100 for cache
        
        // Cache the results
        setCachedLeaderboard(rows);
        
        // Return requested limit
        res.json(rows.slice(0, limit));
    } catch (error) {
        requestStats.errorCount++;
        console.error('Error fetching leaderboard:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// Admin route to clear leaderboard (GET version for easy browser access)
app.get('/api/admin/clear-leaderboard', (req, res) => {
    // Secret token authentication - only you know this token!
    const SECRET_TOKEN = 'ultrathink-x7B9mK2pQ4wZ-donut2025';
    
    // Check if the token is provided and matches
    const providedToken = req.query.token;
    
    if (!providedToken || providedToken !== SECRET_TOKEN) {
        console.log(`Unauthorized clear attempt from IP: ${req.ip}`);
        return res.status(403).json({ 
            error: 'Unauthorized',
            message: 'Invalid or missing authentication token'
        });
    }
    
    // Token is valid, proceed with clearing
    db.run('DELETE FROM scores', function(err) {
        if (err) {
            console.error('Error clearing leaderboard:', err);
            return res.status(500).json({ error: 'Failed to clear leaderboard' });
        }
        
        console.log(`Cleared ${this.changes} scores from leaderboard by authorized user`);
        
        // Clear leaderboard cache
        leaderboardCache.data = null;
        
        // Check how many records remain
        db.get('SELECT COUNT(*) as count FROM scores', (err, row) => {
            const remaining = row ? row.count : 'unknown';
            res.json({ 
                success: true, 
                message: `Successfully cleared ${this.changes} scores from leaderboard`,
                remaining_records: remaining,
                timestamp: new Date().toISOString()
            });
        });
    });
});

// Admin route to check suspicious scores (protected in production)
app.get('/api/admin/suspicious', (req, res) => {
    // In production, add authentication here
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    db.all(`
        SELECT *
        FROM scores
        WHERE is_valid = 0
        OR score > 1000
        OR game_time < score * 10
        ORDER BY timestamp DESC
        LIMIT 50
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        res.json(rows);
    });
});

// Admin route to backup all scores
app.get('/api/admin/backup-scores', (req, res) => {
    // In production, add authentication here
    if (process.env.NODE_ENV === 'production') {
        return res.status(403).json({ error: 'Forbidden' });
    }
    
    db.all(`
        SELECT *
        FROM scores
        ORDER BY timestamp DESC
    `, (err, rows) => {
        if (err) {
            return res.status(500).json({ error: 'Server error' });
        }
        
        // Set headers for file download
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', `attachment; filename="donut-runner-scores-${new Date().toISOString().split('T')[0]}.json"`);
        res.json({
            exportDate: new Date().toISOString(),
            totalScores: rows.length,
            scores: rows
        });
    });
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    const uptime = process.uptime();
    const memUsage = process.memoryUsage();
    
    res.json({
        status: 'healthy',
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
            
            // Close database connection
            db.close((err) => {
                if (err) {
                    console.error('Error closing database:', err);
                    process.exit(1);
                }
                console.log('Database connection closed');
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