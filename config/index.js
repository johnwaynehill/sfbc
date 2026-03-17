require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  sessionSecret: process.env.SESSION_SECRET || 'dev-secret-change-me',
  appUrl: process.env.APP_URL || 'http://localhost:3000',
  databasePath: process.env.DATABASE_PATH || './data/bookclub.sqlite',
  bootstrapKey: process.env.BOOTSTRAP_KEY || '',
  googleBooksApiKey: process.env.GOOGLE_BOOKS_API_KEY || '',
  superAdminEmail: (process.env.SUPER_ADMIN_EMAIL || '').toLowerCase().trim(),
  smtp: {
    host: process.env.SMTP_HOST || '',
    port: parseInt(process.env.SMTP_PORT, 10) || 465,
    secure: (parseInt(process.env.SMTP_PORT, 10) || 465) === 465,
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.SMTP_FROM || '',
  },
  club: {
    name: process.env.CLUB_NAME || 'SF Fantasy & Sci-Fi Book Club',
    tagline: process.env.CLUB_TAGLINE || 'A San Francisco sci-fi & fantasy book club exploring worlds beyond.',
    meetupUrl: process.env.MEETUP_URL || 'https://www.meetup.com/san-francisco-fantasy-book-club/',
  },
  sentry: {
    dsn: process.env.SENTRY_DSN || '',
  },
  posthog: {
    apiKey: process.env.POSTHOG_API_KEY || '',
    host: process.env.POSTHOG_HOST || 'https://us.i.posthog.com',
  },
};
