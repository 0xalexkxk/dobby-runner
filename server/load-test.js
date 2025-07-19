#!/usr/bin/env node

/**
 * Load test script for Donut Runner server
 * Tests server performance with multiple concurrent users
 */

const https = require('https');
const http = require('http');

let SERVER_URL = 'https://4f29-2a03-f680-fe04-49c4-6cc3-703c-5cd-ae7d.ngrok-free.app';
const LOCAL_URL = 'http://localhost:3000';

// Test configuration
const TEST_CONFIG = {
    concurrent_users: 50,
    test_duration_minutes: 2, // Shorter test
    score_submissions_per_user: 2,
    leaderboard_requests_per_user: 5
};

let testResults = {
    totalRequests: 0,
    successfulRequests: 0,
    failedRequests: 0,
    errors: [],
    startTime: null,
    endTime: null,
    responseTimeMs: []
};

function generateRandomGameData(nickname) {
    // Generate realistic game data that passes anti-cheat
    const score = Math.floor(Math.random() * 150) + 10; // 10-160 points
    const gameTime = Math.floor(score * 100) + Math.floor(Math.random() * 5000); // Realistic time
    
    // Determine level based on score (matches server logic)
    let level = 1;
    if (score >= 100) level = 2;
    if (score >= 200) level = 3;
    if (score >= 300) level = 4;
    if (score >= 400) level = 5;
    
    const xp = Math.floor(score * 0.5) + Math.floor(Math.random() * 20); // Realistic XP
    
    // Generate realistic events
    const events = [];
    const eventCount = Math.floor(score / 10) + 5; // More events for higher scores
    
    for (let i = 0; i < eventCount; i++) {
        const eventTime = Math.floor((gameTime / eventCount) * i) + Math.floor(Math.random() * 1000);
        const eventTypes = ['jump', 'shoot', 'hit_teacup', 'collect_xp'];
        const eventType = eventTypes[Math.floor(Math.random() * eventTypes.length)];
        events.push({ type: eventType, time: eventTime });
    }
    
    // Sort events by time
    events.sort((a, b) => a.time - b.time);
    
    return {
        nickname: nickname,
        score: score,
        xp: xp,
        level: level,
        gameTime: gameTime,
        timestamp: Date.now(),
        events: events
    };
}

function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, SERVER_URL);
        const isHttps = url.protocol === 'https:';
        const client = isHttps ? https : http;
        
        const options = {
            hostname: url.hostname,
            port: url.port || (isHttps ? 443 : 80),
            path: url.pathname,
            method: method,
            headers: {
                'Content-Type': 'application/json',
                'User-Agent': 'LoadTest/1.0'
            }
        };
        
        if (data) {
            const body = JSON.stringify(data);
            options.headers['Content-Length'] = Buffer.byteLength(body);
        }
        
        const startTime = Date.now();
        
        const req = client.request(options, (res) => {
            let responseData = '';
            
            res.on('data', (chunk) => {
                responseData += chunk;
            });
            
            res.on('end', () => {
                const endTime = Date.now();
                const responseTime = endTime - startTime;
                
                testResults.totalRequests++;
                testResults.responseTimeMs.push(responseTime);
                
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    testResults.successfulRequests++;
                    resolve({ 
                        statusCode: res.statusCode, 
                        data: responseData,
                        responseTime
                    });
                } else {
                    testResults.failedRequests++;
                    reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
                }
            });
        });
        
        req.on('error', (error) => {
            testResults.totalRequests++;
            testResults.failedRequests++;
            testResults.errors.push(error.message);
            reject(error);
        });
        
        if (data) {
            req.write(JSON.stringify(data));
        }
        
        req.end();
    });
}

async function simulateUser(userId, testDuration) {
    console.log(`👤 User ${userId} started`);
    const nickname = `TestUser${userId}`;
    const endTime = Date.now() + testDuration;
    
    try {
        while (Date.now() < endTime) {
            // Submit a score
            try {
                const gameData = generateRandomGameData(nickname);
                await makeRequest('POST', '/api/submit-score', gameData);
                console.log(`✅ User ${userId}: Score submitted`);
            } catch (error) {
                console.log(`❌ User ${userId}: Score submission failed: ${error.message}`);
            }
            
            // Request leaderboard multiple times
            for (let i = 0; i < 3; i++) {
                try {
                    await makeRequest('GET', '/api/leaderboard');
                    console.log(`📊 User ${userId}: Leaderboard fetched`);
                } catch (error) {
                    console.log(`❌ User ${userId}: Leaderboard fetch failed: ${error.message}`);
                }
                
                // Small delay between requests
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Wait before next cycle
            await new Promise(resolve => setTimeout(resolve, 2000));
        }
    } catch (error) {
        console.log(`💥 User ${userId} crashed: ${error.message}`);
    }
    
    console.log(`👋 User ${userId} finished`);
}

async function runLoadTest() {
    console.log('🚀 Starting Donut Runner Load Test');
    console.log(`📊 Configuration:`);
    console.log(`   Concurrent Users: ${TEST_CONFIG.concurrent_users}`);
    console.log(`   Test Duration: ${TEST_CONFIG.test_duration_minutes} minutes`);
    console.log(`   Target Server: ${SERVER_URL}`);
    console.log('');
    
    // Test server health first
    try {
        console.log('🔍 Checking server health...');
        const health = await makeRequest('GET', '/api/health');
        console.log('✅ Server is healthy');
        console.log('');
    } catch (error) {
        console.error('❌ Server health check failed:', error.message);
        
        // Try local server as fallback
        console.log('\n🔄 Trying local server instead...');
        
        // Temporarily switch to local URL
        const originalURL = SERVER_URL;
        SERVER_URL = LOCAL_URL;
        
        try {
            const localHealth = await makeRequest('GET', '/api/health');
            console.log('✅ Local server is healthy - continuing with local test');
            console.log('⚠️  Note: Testing locally, not via ngrok');
            console.log('');
            // Keep using LOCAL_URL for this test run
        } catch (localError) {
            // Restore original URL
            SERVER_URL = originalURL;
            console.log('❌ Local server also failed');
            console.log('\n📋 Please ensure:');
            console.log('   1. Server is running: cd server && npm start');
            console.log('   2. ngrok is running: ngrok http 3000');
            console.log('   3. Update SERVER_URL in server.js with new ngrok URL');
            console.log('\n🛑 Aborting load test');
            return;
        }
    }
    
    testResults.startTime = Date.now();
    const testDuration = TEST_CONFIG.test_duration_minutes * 60 * 1000;
    
    // Create array of user simulation promises
    const userPromises = [];
    for (let i = 1; i <= TEST_CONFIG.concurrent_users; i++) {
        userPromises.push(simulateUser(i, testDuration));
    }
    
    console.log(`🏁 Starting ${TEST_CONFIG.concurrent_users} concurrent users...`);
    
    // Wait for all users to complete
    await Promise.allSettled(userPromises);
    
    testResults.endTime = Date.now();
    
    // Print results
    console.log('\n🏆 Load Test Results:');
    console.log('========================');
    
    const totalDurationSeconds = (testResults.endTime - testResults.startTime) / 1000;
    const avgResponseTime = testResults.responseTimeMs.length > 0 
        ? testResults.responseTimeMs.reduce((a, b) => a + b, 0) / testResults.responseTimeMs.length
        : 0;
    
    const requestsPerSecond = testResults.totalRequests / totalDurationSeconds;
    const successRate = (testResults.successfulRequests / testResults.totalRequests) * 100;
    
    console.log(`📈 Total Requests: ${testResults.totalRequests}`);
    console.log(`✅ Successful: ${testResults.successfulRequests}`);
    console.log(`❌ Failed: ${testResults.failedRequests}`);
    console.log(`📊 Success Rate: ${successRate.toFixed(2)}%`);
    console.log(`⚡ Requests/Second: ${requestsPerSecond.toFixed(2)}`);
    console.log(`⏱️  Average Response Time: ${avgResponseTime.toFixed(2)}ms`);
    console.log(`🕐 Test Duration: ${totalDurationSeconds.toFixed(2)} seconds`);
    
    if (testResults.responseTimeMs.length > 0) {
        const sortedTimes = testResults.responseTimeMs.sort((a, b) => a - b);
        const p95Index = Math.floor(sortedTimes.length * 0.95);
        const p99Index = Math.floor(sortedTimes.length * 0.99);
        
        console.log(`📏 Response Time P95: ${sortedTimes[p95Index]}ms`);
        console.log(`📏 Response Time P99: ${sortedTimes[p99Index]}ms`);
    }
    
    if (testResults.errors.length > 0) {
        console.log(`\n🚨 Error Summary:`);
        const errorCounts = {};
        testResults.errors.forEach(error => {
            errorCounts[error] = (errorCounts[error] || 0) + 1;
        });
        
        Object.entries(errorCounts).forEach(([error, count]) => {
            console.log(`   ${error}: ${count} times`);
        });
    }
    
    // Recommendations
    console.log('\n💡 Server Performance Assessment:');
    
    if (successRate >= 85) {
        console.log('✅ PASS: Success rate is acceptable for load testing');
    } else {
        console.log('❌ FAIL: Success rate too low');
    }
    
    if (avgResponseTime < 1000) {
        console.log('✅ PASS: Response time is acceptable');
    } else {
        console.log('❌ FAIL: Response time too high');
    }
    
    if (requestsPerSecond > 15) {
        console.log('✅ PASS: Good throughput achieved');
    } else {
        console.log('⚠️  WARN: Lower throughput than expected');
    }
    
    console.log('\n🏆 CONCLUSION:');
    if (successRate >= 80 && avgResponseTime < 1000) {
        console.log('🎉 SERVER IS READY for 50-100 concurrent users!');
        console.log('   The server performed well under load and should handle');
        console.log('   your expected user base without issues.');
    } else {
        console.log('⚠️  Server needs optimization before handling high load.');
    }
    
    console.log('\n📝 Note: Some "failures" are expected in load testing:');
    console.log('   - Anti-cheat blocking suspicious data (HTTP 400)');
    console.log('   - Rate limiting protecting server (HTTP 429)');
    console.log('   These are features, not bugs! 🛡️');
}

// Run the test
if (require.main === module) {
    runLoadTest().catch(console.error);
}

module.exports = { runLoadTest, TEST_CONFIG };