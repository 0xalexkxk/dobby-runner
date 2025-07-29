const sqlite3 = require('sqlite3').verbose();
const { Pool } = require('pg');
require('dotenv').config();

// Check if DATABASE_URL is set
if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL not found in .env file');
    console.error('Please set up your .env file with Supabase credentials');
    process.exit(1);
}

// SQLite connection
const sqliteDb = new sqlite3.Database('./leaderboard.db', (err) => {
    if (err) {
        console.error('❌ Could not open SQLite database:', err.message);
        console.error('Make sure leaderboard.db exists in the current directory');
        process.exit(1);
    }
    console.log('✅ Connected to SQLite database');
});

// PostgreSQL connection
const pgPool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? {
        rejectUnauthorized: false
    } : false
});

async function migrate() {
    try {
        // Test PostgreSQL connection
        await pgPool.query('SELECT NOW()');
        console.log('✅ Connected to PostgreSQL (Supabase)');
        
        // Create table if not exists
        await pgPool.query(`
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
        console.log('✅ PostgreSQL table ready');
        
        // Get all scores from SQLite
        const scores = await new Promise((resolve, reject) => {
            sqliteDb.all('SELECT * FROM scores ORDER BY timestamp', (err, rows) => {
                if (err) reject(err);
                else resolve(rows);
            });
        });
        
        console.log(`📊 Found ${scores.length} scores to migrate`);
        
        if (scores.length === 0) {
            console.log('ℹ️  No scores to migrate');
            return;
        }
        
        // Check if PostgreSQL already has data
        const pgCount = await pgPool.query('SELECT COUNT(*) as count FROM scores');
        if (pgCount.rows[0].count > 0) {
            console.log(`⚠️  PostgreSQL already contains ${pgCount.rows[0].count} scores`);
            const readline = require('readline').createInterface({
                input: process.stdin,
                output: process.stdout
            });
            
            const answer = await new Promise(resolve => {
                readline.question('Do you want to continue and merge data? (yes/no): ', resolve);
            });
            readline.close();
            
            if (answer.toLowerCase() !== 'yes') {
                console.log('Migration cancelled');
                return;
            }
        }
        
        // Migrate scores in batches
        const batchSize = 100;
        let migrated = 0;
        
        for (let i = 0; i < scores.length; i += batchSize) {
            const batch = scores.slice(i, i + batchSize);
            
            // Build insert query for batch
            const values = [];
            const placeholders = [];
            
            batch.forEach((score, index) => {
                const offset = index * 10;
                placeholders.push(`($${offset + 1}, $${offset + 2}, $${offset + 3}, $${offset + 4}, $${offset + 5}, $${offset + 6}, $${offset + 7}, $${offset + 8}, $${offset + 9}, $${offset + 10})`);
                
                values.push(
                    score.nickname,
                    score.score,
                    score.xp || 0,
                    score.level || 1,
                    score.game_time || 0,
                    score.ip_address,
                    score.user_agent,
                    score.timestamp,
                    score.is_valid !== 0,
                    score.validation_hash
                );
            });
            
            // Insert batch with ON CONFLICT to handle duplicates
            const query = `
                INSERT INTO scores (nickname, score, xp, level, game_time, ip_address, user_agent, timestamp, is_valid, validation_hash)
                VALUES ${placeholders.join(', ')}
                ON CONFLICT (nickname) DO UPDATE SET
                    score = GREATEST(scores.score, EXCLUDED.score),
                    xp = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.xp ELSE scores.xp END,
                    level = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.level ELSE scores.level END,
                    game_time = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.game_time ELSE scores.game_time END,
                    timestamp = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.timestamp ELSE scores.timestamp END,
                    validation_hash = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.validation_hash ELSE scores.validation_hash END
            `;
            
            try {
                await pgPool.query(query, values);
                migrated += batch.length;
                console.log(`✅ Migrated ${migrated}/${scores.length} scores`);
            } catch (err) {
                console.error(`❌ Error migrating batch starting at index ${i}:`, err.message);
                
                // Try to insert records one by one to identify problematic records
                for (const score of batch) {
                    try {
                        await pgPool.query(`
                            INSERT INTO scores (nickname, score, xp, level, game_time, ip_address, user_agent, timestamp, is_valid, validation_hash)
                            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                            ON CONFLICT (nickname) DO UPDATE SET
                                score = GREATEST(scores.score, EXCLUDED.score),
                                xp = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.xp ELSE scores.xp END,
                                level = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.level ELSE scores.level END,
                                game_time = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.game_time ELSE scores.game_time END,
                                timestamp = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.timestamp ELSE scores.timestamp END,
                                validation_hash = CASE WHEN EXCLUDED.score > scores.score THEN EXCLUDED.validation_hash ELSE scores.validation_hash END
                        `, [
                            score.nickname,
                            score.score,
                            score.xp || 0,
                            score.level || 1,
                            score.game_time || 0,
                            score.ip_address,
                            score.user_agent,
                            score.timestamp,
                            score.is_valid !== 0,
                            score.validation_hash
                        ]);
                    } catch (individualErr) {
                        console.error(`❌ Failed to migrate score for ${score.nickname}:`, individualErr.message);
                    }
                }
            }
        }
        
        // Verify migration
        const finalCount = await pgPool.query('SELECT COUNT(*) as count FROM scores');
        console.log(`\n✅ Migration complete! PostgreSQL now has ${finalCount.rows[0].count} scores`);
        
        // Show top 10 scores
        const top10 = await pgPool.query(`
            SELECT nickname, MAX(score) as score
            FROM scores
            GROUP BY nickname
            ORDER BY score DESC
            LIMIT 10
        `);
        
        console.log('\n🏆 Top 10 Scores:');
        top10.rows.forEach((row, index) => {
            console.log(`${index + 1}. ${row.nickname}: ${row.score}`);
        });
        
    } catch (error) {
        console.error('❌ Migration failed:', error);
    } finally {
        // Close connections
        sqliteDb.close();
        await pgPool.end();
        process.exit(0);
    }
}

// Add unique constraint if it doesn't exist
async function addUniqueConstraint() {
    try {
        await pgPool.query(`
            ALTER TABLE scores 
            ADD CONSTRAINT unique_nickname UNIQUE (nickname)
        `);
        console.log('✅ Added unique constraint on nickname');
    } catch (err) {
        if (err.code === '42P07') { // duplicate_table error code
            console.log('ℹ️  Unique constraint already exists');
        } else if (err.code === '23505') { // unique_violation error code
            console.log('⚠️  Cannot add unique constraint - duplicate nicknames exist');
            console.log('ℹ️  Migration will keep the highest score for each nickname');
        } else {
            console.log('ℹ️  Constraint might already exist or not needed');
        }
    }
}

// Run migration
console.log('🚀 Starting SQLite to PostgreSQL migration...\n');
addUniqueConstraint().then(() => migrate());