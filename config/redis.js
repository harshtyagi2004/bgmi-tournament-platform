const Redis = require('ioredis');

// Create Redis instance with disabled auto-reconnect on fail
const redis = new Redis(process.env.REDIS_URL || 'redis://127.0.0.1:6379', {
  lazyConnect: true,
  maxRetriesPerRequest: 0, // Stop retrying if server is down
  retryStrategy: () => null, // Suppress continuous reconnection spam
});

redis.on('connect', () => console.log('⚡ Redis Cache Engine Connected'));
redis.on('error', (err) => {
  // Gracefully log offline status without breaking the app
  console.warn('⚠️ Redis is offline. Real-time caching disabled (Fallback active).');
});

module.exports = redis;