'use strict';

const Sentry = require('@sentry/node');
const config = require('./config');
const analytics = require('./services/analytics');

// ---------------------------------------------------------------------------
// Sentry (error tracking) — init before anything else
// ---------------------------------------------------------------------------
if (config.sentry.dsn) {
  Sentry.init({
    dsn: config.sentry.dsn,
    environment: config.nodeEnv,
    tracesSampleRate: 0.1,
  });
}

// ---------------------------------------------------------------------------
// Database & migrations
// ---------------------------------------------------------------------------
const migrate = require('./db/migrate');
migrate();

// ---------------------------------------------------------------------------
// App (extracted to app.js for testability)
// ---------------------------------------------------------------------------
const app = require('./app');

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
const host = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
const server = app.listen(config.port, host, () => {
  console.log(`\n  GatherBound running at http://${host}:${config.port}\n`);
});

// ---------------------------------------------------------------------------
// Graceful shutdown — flush analytics before exit
// ---------------------------------------------------------------------------
process.on('SIGTERM', async () => {
  console.log('SIGTERM received — shutting down gracefully');
  await analytics.shutdown();
  server.close(() => process.exit(0));
});
