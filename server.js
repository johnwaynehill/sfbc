const express = require('express');
const path = require('path');
const compression = require('compression');
const expressLayouts = require('express-ejs-layouts');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { formatMonthYear, formatStatus, monthYearSlug } = require('./utils/format');

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
// Static files & body parsing
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: config.nodeEnv === 'production' ? '7d' : 0,
  etag: true,
}));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------
// Trust the first proxy (Fly.io) so secure cookies work behind HTTPS termination
app.set('trust proxy', 1);

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
// Global template locals
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.club = config.club;
  res.locals.currentPath = req.path;
  res.locals.formatMonthYear = formatMonthYear;
  res.locals.formatStatus = formatStatus;
  res.locals.monthYearSlug = monthYearSlug;
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
// Routes
// ---------------------------------------------------------------------------
app.use('/', require('./routes/public'));
app.use('/', require('./routes/nominate'));
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
const host = process.env.NODE_ENV === 'production' ? '0.0.0.0' : 'localhost';
app.listen(config.port, host, () => {
  console.log(`\n  SF Book Club running at http://${host}:${config.port}\n`);
});
