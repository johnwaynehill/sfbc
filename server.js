const express = require('express');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const config = require('./config');

const app = express();

// ---------------------------------------------------------------------------
// View engine
// ---------------------------------------------------------------------------
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.set('layout', 'layouts/app-shell');
app.use(expressLayouts);

// ---------------------------------------------------------------------------
// Static files & body parsing
// ---------------------------------------------------------------------------
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// ---------------------------------------------------------------------------
// Session (Phase 1 — uncomment when SQLite session store is ready)
// ---------------------------------------------------------------------------
// const session = require('express-session');
// app.use(session({
//   secret: config.sessionSecret,
//   resave: false,
//   saveUninitialized: false,
//   cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }, // 30 days
// }));

// ---------------------------------------------------------------------------
// Global template locals
// ---------------------------------------------------------------------------
app.use((req, res, next) => {
  res.locals.club = config.club;
  res.locals.currentPath = req.path;
  next();
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
app.listen(config.port, () => {
  console.log(`\n  SF Book Club running at http://localhost:${config.port}\n`);
});
