require('dotenv').config();
const cron = require('node-cron');
const RoutingDatabase = require('./database');

const db = new RoutingDatabase(process.env.DB_PATH || './routing.db');

// Run every hour at minute 0
const cronExpression = process.env.CRON_SCHEDULE || '0 * * * *';

console.log(`Starting cron service with schedule: ${cronExpression}`);

cron.schedule(cronExpression, () => {
  try {
    const count = db.pruneExpiredRules();
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] Pruned ${count} expired routing rules`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error pruning expired rules:`, error);
  }
});

// Run once on startup
try {
  const count = db.pruneExpiredRules();
  console.log(`Initial cleanup: Pruned ${count} expired routing rules`);
} catch (error) {
  console.error('Error during initial cleanup:', error);
}

// Graceful shutdown
const closeGracefully = (signal) => {
  console.log(`Received signal to terminate: ${signal}`);
  db.close();
  process.exit(0);
};

process.on('SIGINT', closeGracefully);
process.on('SIGTERM', closeGracefully);

console.log('Cron service is running. Press Ctrl+C to stop.');
