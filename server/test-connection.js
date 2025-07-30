const { Pool } = require('pg');

// Test Neon PostgreSQL connection
const configs = [
    // Config 1: Full Neon connection string (from user)
    {
        connectionString: 'postgresql://neondb_owner:npg_4JzgtwGs8vaB@ep-still-recipe-aebtat60-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
    },
    // Config 2: Neon without channel_binding
    {
        connectionString: 'postgresql://neondb_owner:npg_4JzgtwGs8vaB@ep-still-recipe-aebtat60-pooler.c-2.us-east-2.aws.neon.tech/neondb?sslmode=require'
    },
    // Config 3: Neon object config
    {
        host: 'ep-still-recipe-aebtat60-pooler.c-2.us-east-2.aws.neon.tech',
        port: 5432,
        database: 'neondb',
        user: 'neondb_owner',
        password: 'npg_4JzgtwGs8vaB',
        ssl: {
            rejectUnauthorized: false,
            sslmode: 'require'
        }
    }
];

async function testConnection(config, index) {
    console.log(`\n🔄 Testing config ${index + 1}:`, config);
    
    try {
        const pool = new Pool(config);
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as now, VERSION() as version');
        console.log(`✅ SUCCESS! Connected at:`, result.rows[0].now);
        console.log(`📋 PostgreSQL version:`, result.rows[0].version.substring(0, 50) + '...');
        client.release();
        await pool.end();
        return true;
    } catch (error) {
        console.log(`❌ FAILED:`, error.message);
        return false;
    }
}

async function runTests() {
    console.log('🚀 Testing PostgreSQL connections...\n');
    
    for (let i = 0; i < configs.length; i++) {
        const success = await testConnection(configs[i], i);
        if (success) {
            console.log('\n🎉 Found working configuration!');
            process.exit(0);
        }
    }
    
    console.log('\n💥 No working configuration found');
    process.exit(1);
}

runTests();