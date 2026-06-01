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
// One-time cover migration: copy covers from the Docker image's public/
// directory to the persistent data volume so they survive future deploys.
// ---------------------------------------------------------------------------
const fs = require('fs');
const path = require('path');
const dataDir = path.dirname(path.resolve(config.databasePath));
const persistentCovers = path.join(dataDir, 'covers');
const bundledCovers = path.join(__dirname, 'public', 'img', 'covers');

if (fs.existsSync(bundledCovers)) {
  fs.mkdirSync(persistentCovers, { recursive: true });
  for (const file of fs.readdirSync(bundledCovers)) {
    const dest = path.join(persistentCovers, file);
    if (!fs.existsSync(dest)) {
      fs.copyFileSync(path.join(bundledCovers, file), dest);
    }
  }
}

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
