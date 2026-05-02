'use strict';
const express = require('express');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const Sentry = require('@sentry/node');
const config = require('./config');
const analytics = require('./services/analytics');
const { formatMonthYear, formatStatus, monthYearSlug, formatMeetingTime } = require('./utils/format');

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
const db = require('./db');
const migrate = require('./db/migrate');
migrate();

// ---------------------------------------------------------------------------
// Session store
// ---------------------------------------------------------------------------
const SqliteStore = require('better-sqlite3-session-store')(session);

const app = express();

// Trust the first proxy (Fly.io) so rate limiting and secure cookies use real
// client IPs instead of the shared proxy address.
app.set('trust proxy', 1);

// ---------------------------------------------------------------------------
// Static files (served before rate limiting so assets don't count against it)
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '7d' : 0,
  etag: true,
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
      // Helmet adds upgrade-insecure-requests by default, which forces every
      // subresource to https. That breaks LAN dev testing (e.g. accessing
      // the dev server from a phone on the same WiFi) since there's no TLS.
      // Keep the upgrade behavior in production; turn it off in dev.
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
    // Don't compress SSE streams — compression buffers the response
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
      clear: true,
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
// Sentry user context
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  if (config.sentry.dsn && res.locals.user) {
    Sentry.setUser({ id: String(res.locals.user.id), email: res.locals.user.email });
  } else if (config.sentry.dsn) {
    Sentry.setUser(null);
  }
  next();
});

// ---------------------------------------------------------------------------
// Rate limiting — after session so we can key by user instead of IP
// ---------------------------------------------------------------------------
app.use(rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    if (req.session && req.session.userId) {
      return `user-${req.session.userId}`;
    }
    // Use ipKeyGenerator so IPv6 visitors are bucketed by their subnet
    // prefix (/56 by default) — otherwise a single user could rotate
    // addresses within their allocation to bypass the limit.
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
// When gatherbound.club hits /, serve the landing page instead of club home
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
    errorMessage: 'The page you\u2019re looking for doesn\u2019t exist.',
  });
});

// ---------------------------------------------------------------------------
// Error handler
// ---------------------------------------------------------------------------
app.use((err, req, res, _next) => {
  if (config.sentry.dsn) Sentry.captureException(err);
  console.error(err.stack);
  res.status(500).render('error', {
    pageTitle: 'Error',
    errorCode: 500,
    errorMessage: config.nodeEnv === 'development' ? err.message : 'Something went wrong.',
  });
});

// ---------------------------------------------------------------------------
// Start
// ---------------------------------------------------------------------------
// HOST env override lets you bind to 0.0.0.0 in dev so you can hit the
// server from another device on the LAN (e.g. testing on a real phone).
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
