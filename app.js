'use strict';

/**
 * Express app factory — extracted from server.js so the app can be
 * imported by integration tests without starting a listener.
 *
 * Usage:
 *   const app = require('./app');
 *   // In production (server.js): app.listen(...)
 *   // In tests: supertest(app)
 */

const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const config = require('./config');
const db = require('./db');
const { formatMonthYear, formatStatus, monthYearSlug, formatMeetingTime } = require('./utils/format');

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------
const SqliteStore = require('better-sqlite3-session-store')(session);

const app = express();

// Trust the first proxy (Fly.io)
app.set('trust proxy', 1);

// The club moved to GatherBound (Oct 2026): with REDIRECT_TO set, every page
// goes to the same page there. Before anything else, static files included.
if (process.env.REDIRECT_TO) {
  app.use(require('./middleware/redirect-to-gatherbound')(process.env.REDIRECT_TO));
}

// ---------------------------------------------------------------------------
// Static files
// ---------------------------------------------------------------------------

// Book covers are stored on the persistent data volume (survives deploys).
const dataDir = path.dirname(path.resolve(config.databasePath));
app.use('/img/covers', express.static(path.join(dataDir, 'covers'), {
  maxAge: config.nodeEnv === 'production' ? '30d' : 0,
  etag: true,
}));

// Everything else from the public/ directory (CSS, JS, icons, etc.)
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '7d' : 0,
  etag: true,
  setHeaders: (res, filePath) => {
    // The service worker must always be revalidated so logic changes ship
    // immediately instead of being held by the browser's 7d cache.
    if (filePath.endsWith('sw.js')) {
      res.setHeader('Cache-Control', 'no-cache');
    }
  },
}));

// ---------------------------------------------------------------------------
// Security headers
// ---------------------------------------------------------------------------
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://us-assets.i.posthog.com', 'https://tally.so'],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'https://api.dicebear.com', 'https://books.google.com', 'https://covers.openlibrary.org'],
      fontSrc: ["'self'", 'https://fonts.gstatic.com'],
      connectSrc: ["'self'", 'https://fonts.googleapis.com', 'https://fonts.gstatic.com', 'https://api.dicebear.com', 'https://us.i.posthog.com', 'https://us-assets.i.posthog.com'],
      frameSrc: ["'self'", 'https://tally.so'],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      upgradeInsecureRequests: config.nodeEnv === 'production' ? [] : null,
    },
  },
}));

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/app-shell');
app.use(expressLayouts);

// ---------------------------------------------------------------------------
// Compression
// ---------------------------------------------------------------------------
app.use(compression({
  filter: (req, res) => {
    if (req.headers.accept === 'text/event-stream') return false;
    return compression.filter(req, res);
  },
}));

// ---------------------------------------------------------------------------
// Body parsing
// ---------------------------------------------------------------------------
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
app.use(session({
  store: new SqliteStore({
    client: db,
    expired: {
      clear: config.nodeEnv !== 'test',
      intervalMs: 900000,
    },
  }),
  secret: config.sessionSecret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 30 * 24 * 60 * 60 * 1000,
    httpOnly: true,
    sameSite: 'lax',
    secure: config.nodeEnv === 'production',
  },
}));

// ---------------------------------------------------------------------------
// User injection
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.user = null;
  if (req.session && req.session.userId) {
    const user = db.prepare('SELECT id, email, display_name, role, avatar_style FROM users WHERE id = ?')
      .get(req.session.userId);
    if (user) {
      res.locals.user = user;
    } else {
      delete req.session.userId;
    }
  }
  next();
});

// ---------------------------------------------------------------------------
// Rate limiting
// ---------------------------------------------------------------------------
const meetingPathRe = /^\/(nominate|vote|results)(\/|$)|^\/api\/(meetings\/\d+\/(nominations|votes)|books\/search)/;

app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => meetingPathRe.test(req.path),
  keyGenerator: (req) => {
    if (req.session && req.session.userId) {
      return `user-${req.session.userId}`;
    }
    return ipKeyGenerator(req.ip);
  },
}));

// ---------------------------------------------------------------------------
// Global template locals
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.club = config.club;
  res.locals.currentPath = req.path;
  res.locals.formatMonthYear = formatMonthYear;
  res.locals.formatStatus = formatStatus;
  res.locals.formatMeetingTime = formatMeetingTime;
  res.locals.monthYearSlug = monthYearSlug;
  res.locals.colorHash = require('./utils/colorHash').colorHash;
  res.locals.posthogApiKey = process.env.NODE_ENV === 'production' ? config.posthog.apiKey : '';
  res.locals.posthogHost = config.posthog.host;
  res.locals.isProduction = config.nodeEnv === 'production';
  res.locals.gradeTier = function (grade) {
    if (!grade) return '';
    var letter = grade.charAt(0).toUpperCase();
    if (letter === 'S') return 'grade-badge--s';
    if (letter === 'A') return 'grade-badge--a';
    if (letter === 'B') return 'grade-badge--b';
    if (letter === 'C') return 'grade-badge--c';
    if (letter === 'D') return 'grade-badge--d';
    if (letter === 'F') return 'grade-badge--f';
    return '';
  };
  next();
});

// ---------------------------------------------------------------------------
// Health check
// ---------------------------------------------------------------------------
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// ---------------------------------------------------------------------------
// GatherBound domain routing
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  const host = req.hostname;
  if ((host === 'gatherbound.club' || host === 'www.gatherbound.club') && req.path === '/') {
    req.url = '/landing';
  }
  next();
});

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------
app.use('/', require('./routes/public'));
app.use('/', require('./routes/nominate'));
app.use('/', require('./routes/nominations'));
app.use('/', require('./routes/vote'));
app.use('/', require('./routes/results'));
app.use('/', require('./routes/auth'));
app.use('/', require('./routes/reviews'));
app.use('/admin', require('./routes/admin'));
app.use('/api', require('./routes/api'));

// ---------------------------------------------------------------------------
// 404
// ---------------------------------------------------------------------------
app.use((req, res) => {
  res.status(404).render('error', {
    pageTitle: 'Page Not Found',
    errorCode: 404,
    errorMessage: 'The page you’re looking for doesn’t exist.',
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  console.error(err.stack);
  res.status(500).render('error', {
    pageTitle: 'Error',
    errorCode: 500,
    errorMessage: config.nodeEnv === 'development' ? err.message : 'Something went wrong.',
  });
});

module.exports = app;
