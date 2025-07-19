# 🚀 Performance Optimization Guide

## Server Optimizations Applied

### 1. Database Performance
- **WAL Mode**: Enabled Write-Ahead Logging for better concurrent read/write performance
- **Optimized Pragmas**: Configured SQLite for better memory usage and performance
- **Indexes**: Added proper indexes for faster queries
- **Async Operations**: Converted all database operations to async/await pattern

### 2. Caching
- **Leaderboard Cache**: 30-second in-memory cache for leaderboard requests
- **Cache Invalidation**: Automatic cache clearing when new scores are submitted

### 3. Rate Limiting
- **Submit Scores**: 50 requests per 15 minutes per IP
- **Leaderboard**: 300 requests per minute per IP
- Optimized for 100+ concurrent users

### 4. Monitoring
- **Performance Stats**: Real-time tracking of request counts and errors
- **Health Check**: `/api/health` endpoint for monitoring server status
- **Error Tracking**: Comprehensive error logging and counting

### 5. Stability
- **Graceful Shutdown**: Proper cleanup of database connections
- **Error Handling**: Comprehensive error handling for uncaught exceptions
- **Connection Management**: Better handling of database connections

## Load Testing

### Running Load Tests
```bash
cd server
node load-test.js
```

### Test Configuration
- **Default**: 50 concurrent users for 5 minutes
- **Requests**: ~3 score submissions + 10 leaderboard requests per user
- **Expected**: 95%+ success rate, <500ms average response time

### Server Capacity Estimates

| Metric | Conservative | Optimistic |
|--------|-------------|------------|
| Concurrent Users | 50-75 | 100-150 |
| Requests/Second | 20-30 | 50-80 |
| Response Time | <500ms | <300ms |
| Success Rate | >95% | >99% |

## Monitoring in Production

### Health Check
```bash
curl https://your-server.com/api/health
```

### Key Metrics to Watch
1. **Success Rate**: Should stay above 95%
2. **Response Time**: Average <500ms, P95 <1000ms
3. **Memory Usage**: Monitor for memory leaks
4. **Error Count**: Should be minimal
5. **Cache Hit Rate**: Should be high for leaderboard requests

### Performance Logs
Server automatically logs performance stats every 5 minutes:
```
📊 Performance Stats (last 5.0 min):
   Submit requests: 45 (9.0/min)
   Leaderboard requests: 230 (46.0/min)
   Errors: 2
```

## Scaling Recommendations

### For 100+ Users
1. **Database**: Consider PostgreSQL for better concurrent performance
2. **Caching**: Implement Redis for distributed caching
3. **Load Balancing**: Use multiple server instances behind a load balancer
4. **CDN**: Serve static files via CDN

### For 500+ Users
1. **Microservices**: Split leaderboard and game submission services
2. **Database Sharding**: Distribute data across multiple databases
3. **Message Queues**: Async processing for score submissions
4. **Auto-scaling**: Implement horizontal scaling based on load

## Troubleshooting

### Common Issues

#### High Response Times
- Check database performance
- Monitor memory usage
- Verify disk I/O isn't bottlenecked

#### Database Lock Errors
- Ensure WAL mode is enabled
- Check for long-running transactions
- Consider connection pooling

#### Memory Leaks
- Monitor heap usage via `/api/health`
- Check for unclosed database connections
- Review caching strategy

#### High Error Rate
- Check server logs for specific errors
- Verify database connectivity
- Monitor rate limiting effectiveness

### Quick Fixes
```bash
# Restart server
pm2 restart donut-runner

# Clear cache manually (if needed)
curl -X POST https://your-server.com/api/admin/clear-leaderboard

# Check server status
curl https://your-server.com/api/health
```

## Production Deployment

### Recommended Setup
1. **Process Manager**: Use PM2 for process management
2. **Reverse Proxy**: Use Nginx for SSL termination and load balancing
3. **Monitoring**: Set up health checks and alerting
4. **Backup**: Regular database backups
5. **Security**: Regular security updates and monitoring

### PM2 Configuration
```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'donut-runner',
    script: 'server.js',
    instances: 'max',
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    }
  }]
}
```

### Nginx Configuration
```nginx
upstream donut-runner {
    server 127.0.0.1:3000;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://donut-runner;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
    
    location /api/health {
        proxy_pass http://donut-runner;
        access_log off;
    }
}
```

## Performance Checklist

- [ ] WAL mode enabled for SQLite
- [ ] Proper database indexes created
- [ ] Leaderboard caching implemented
- [ ] Rate limiting configured
- [ ] Health check endpoint available
- [ ] Graceful shutdown implemented
- [ ] Error handling comprehensive
- [ ] Load testing completed
- [ ] Monitoring setup
- [ ] Backup strategy in place

## Expected Performance

With these optimizations, your server should easily handle:
- ✅ 50-100 concurrent users
- ✅ 1000+ requests per minute
- ✅ <500ms average response time
- ✅ >95% success rate
- ✅ Stable operation for hours/days

The server is now production-ready for your expected load! 🎉